#!/usr/bin/env python3
"""XOXO Safety BETA: real GoTrue Auth-issued JWT -> isolated PostgREST -> RPC.

ONLY disposable CI databases:
  GoTrue identity DB: xoxo_gotrue_ci (own migrations)
  Safety contract DB: xoxo_safety_test (existing synthetic fixtures)
A GoTrue-issued session is mirrored into the *disposable* contract fixture's
minimal auth.sessions table so the real session_id and user_id can pass our
server-side session/authorization checks. NO production secrets or connections.
"""
import base64
import json
import os
import subprocess
import time
import uuid
import urllib.error
import urllib.request

AUTH="http://127.0.0.1:9999"
REST="http://127.0.0.1:3001"
PEER="22222222-2222-4222-8222-222222222222"
MESSAGE=str(uuid.uuid4())
RECEIPT_KEY=str(uuid.uuid4())

assert os.environ.get("PGHOST")=="127.0.0.1"
assert os.environ.get("PGDATABASE")=="xoxo_safety_test"
assert os.environ.get("PGUSER")=="postgres"


def http(base,method,route,body=None,token=None):
    headers={"Accept":"application/json"}
    if token: headers["Authorization"]="Bearer "+token
    data=None
    if body is not None:
        data=json.dumps(body,separators=(",",":")).encode()
        headers["Content-Type"]="application/json"
    req=urllib.request.Request(base+route,data=data,headers=headers,method=method)
    try:
        with urllib.request.urlopen(req,timeout=12) as resp:
            return resp.status,json.loads(resp.read().decode() or "null")
    except urllib.error.HTTPError as exc:
        raw=exc.read().decode()
        try: return exc.code,json.loads(raw)
        except ValueError:return exc.code,{"message":raw[:350]}


def db(sql):
    result=subprocess.run(["psql","-XAtq","-v","ON_ERROR_STOP=1","-c",sql],
      check=False,text=True,capture_output=True,timeout=15)
    if result.returncode:
        raise AssertionError("Disposable DB fixture rejected: "+result.stderr[:500])
    return result.stdout.strip()


def claims(token):
    pieces=token.split(".")
    assert len(pieces)==3,"Supabase Auth did not return a JWT"
    data=pieces[1]
    data += "="*((4-len(data)%4)%4)
    return json.loads(base64.urlsafe_b64decode(data))


def required_uuid(value,label):
    try:return str(uuid.UUID(value))
    except (ValueError,TypeError,AttributeError):
        raise AssertionError(label+" missing from real Auth-issued JWT") from None


def run():
    email="xoxo-isolated-ci-"+uuid.uuid4().hex[:12]+"@example.invalid"
    password="XoxoLocalTestOnly!"+uuid.uuid4().hex[:18]
    status,signup=http(AUTH,"POST","/signup",
      {"email":email,"password":password})
    assert status in (200,201) and isinstance(signup,dict),(
      "GoTrue Auth signup failed",status,signup)
    token=signup.get("access_token")
    if not token:
        # Some configurations return a user without the access token and
        # require an explicit password login after autocheck.
        status,signup=http(AUTH,"POST","/token?grant_type=password",
          {"email":email,"password":password})
        assert status==200,("GoTrue password login failed",status,signup)
        token=signup.get("access_token")
    assert isinstance(token,str),"GoTrue must issue a real access token"
    decoded=claims(token)
    user=required_uuid(decoded.get("sub"),"sub")
    session=required_uuid(decoded.get("session_id"),"session_id")
    assert decoded.get("role")=="authenticated",(decoded.get("role"),"unexpected Auth role")
    assert decoded.get("is_anonymous") is not True,"Signed-in email user incorrectly anonymous"
    assert int(decoded.get("exp",0))>int(time.time()),"GoTrue access token expired"

    # Make the genuinely Auth-issued identity visible to the *isolated*
    # contract DB. This mirrors GoTrue's user/session records but never
    # touches the real Supabase Auth DB or any XOXO member.
    db("insert into auth.sessions(id,user_id,not_after) values "
       f"('{session}'::uuid,'{user}'::uuid,now()+interval '1 hour')")
    db("insert into public.direct_messages(id,sender_id,recipient_id,content,created_at) values "
       f"('{MESSAGE}'::uuid,'{PEER}'::uuid,'{user}'::uuid,"
       "'GoTrue isolated test message',now()-interval '15 minutes')")

    status,rows=http(REST,"GET","/direct_messages?select=id",token=token)
    assert status==200 and any(row.get("id")==MESSAGE for row in rows),(
      "Auth-issued JWT was not honored by real PostgREST and RLS",status,rows)

    payload={"p_other_user_id":PEER,"p_reason_code":1,
      "p_details":"An isolated Auth token test, no real user data",
      "p_message_ids":[MESSAGE],"p_idempotency_key":RECEIPT_KEY}
    status,_=http(REST,"POST","/rpc/xoxo_submit_conversation_report_beta",
      payload,token)
    assert status in (400,401,403,404,406),(
      "Non-allowlisted GoTrue member reached the report RPC",status)
    db("insert into xoxo_safety_private.report_beta_testers(user_id) "
       f"values ('{user}'::uuid)")
    status,report=http(REST,"POST","/rpc/xoxo_submit_conversation_report_beta",
      payload,token)
    assert status==200 and isinstance(report,str),(
      "Real Auth-issued JWT could not call report RPC",status,report)
    report_id=required_uuid(report,"persisted report receipt")
    assert db("select count(*) from xoxo_safety_private.conversation_reports "
              f"where reporter_id='{user}'::uuid and id='{report_id}'::uuid")=="1",(
      "Real Auth user did not create one private moderation report")
    assert db("select count(*) from xoxo_safety_private.conversation_report_evidence "
              f"where report_id='{report_id}'::uuid")=="1",(
      "Real Auth user's selected evidence not persisted atomically")

    status,replayed=http(REST,"POST","/rpc/xoxo_submit_conversation_report_beta",
      payload,token)
    assert status==200 and replayed==report_id,(
      "Real Auth-issued token idempotent retry failed",status,replayed)

    # A session can be revoked while an otherwise correctly signed JWT
    # remains cryptographically valid. Our report server must fail closed.
    db("delete from auth.sessions where id="+f"'{session}'::uuid")
    payload["p_idempotency_key"]=str(uuid.uuid4())
    status,denied=http(REST,"POST","/rpc/xoxo_submit_conversation_report_beta",
      payload,token)
    assert status in (400,401,403,404,406),(
      "Revoked Auth session incorrectly accepted",status,denied)
    assert db("select count(*) from xoxo_safety_private.conversation_reports "
              f"where reporter_id='{user}'::uuid")=="1",(
      "Revoked Auth session created additional moderation report")
    print("PASS: real isolated GoTrue-issued Supabase Auth token -> PostgREST RLS "
          "-> authenticated report RPC, one immutable receipt + evidence, "
          "idempotency and revoked-session denial; zero production data")


if __name__=="__main__":run()
