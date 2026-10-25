#!/usr/bin/env python3
"""Real GoTrue-issued session read from its native Auth table by report RPC.

This test has no session mirroring: GoTrue and PostgREST use the SAME
DISPOSABLE xoxo_gotrue_ci database. Synthetic messages and local JWT key only.
"""
import json
import subprocess
import time
import uuid
import urllib.error
import urllib.request
import base64

AUTH="http://127.0.0.1:9999"
REST="http://127.0.0.1:3002"
PEER="22222222-2222-4222-8222-222222222222"


def http(base,method,route,data=None,token=None):
    headers={"Accept":"application/json"}
    if token:headers["Authorization"]="Bearer "+token
    encoded=None
    if data is not None:
        encoded=json.dumps(data).encode()
        headers["Content-Type"]="application/json"
    req=urllib.request.Request(base+route,data=encoded,headers=headers,method=method)
    try:
        with urllib.request.urlopen(req,timeout=15) as response:
            return response.status,json.loads(response.read().decode() or "null")
    except urllib.error.HTTPError as exc:
        try:return exc.code,json.loads(exc.read())
        except ValueError:return exc.code,{"error":"non-JSON response"}


def db(sql):
    p=subprocess.run(["psql","-XAtq","-v","ON_ERROR_STOP=1",
        "-d","xoxo_gotrue_ci","-c",sql],text=True,capture_output=True,timeout=15)
    if p.returncode:raise AssertionError("Disposable native Auth SQL failed: "+p.stderr[:450])
    return p.stdout.strip()


def run():
    assert db("select current_database()") == "xoxo_gotrue_ci"
    assert db("select to_regclass('auth.sessions') is not null") == "t"
    email="xoxo-native-"+uuid.uuid4().hex[:14]+"@example.invalid"
    password="NativeLocalOnly!"+uuid.uuid4().hex[:18]
    code,session=http(AUTH,"POST","/signup",{"email":email,"password":password})
    assert code in (200,201),("GoTrue signup failed",code,session)
    token=session.get("access_token")
    if not token:
        code,session=http(AUTH,"POST","/token?grant_type=password",
            {"email":email,"password":password})
        assert code==200,("GoTrue login failed",code,session)
        token=session.get("access_token")
    assert isinstance(token,str),"GoTrue did not issue a signed token"
    middle=token.split(".")[1]
    claims=json.loads(base64.urlsafe_b64decode(middle+"="*((4-len(middle)%4)%4)))
    user=str(uuid.UUID(claims["sub"]))
    session_id=str(uuid.UUID(claims["session_id"]))
    assert claims.get("is_anonymous") is not True
    assert int(claims["exp"])>int(time.time())

    # Crucial: GoTrue wrote this row itself. NO manual mirror, insert, or
    # modification of auth.sessions is permitted before this assertion.
    assert db("select count(*) from auth.sessions where "
        f"id='{session_id}'::uuid and user_id='{user}'::uuid") == "1",(
        "Real GoTrue login did not create its native session row")
    message=str(uuid.uuid4())
    db("insert into public.direct_messages(id,sender_id,recipient_id,content,created_at) values "
       f"('{message}'::uuid,'{PEER}'::uuid,'{user}'::uuid,"
       "'Native Auth synthetic evidence',now())")

    code,visible=http(REST,"GET","/direct_messages?select=id",token=token)
    assert code==200 and any(x.get("id")==message for x in visible),(
        "Native Auth JWT failed PostgREST RLS",code,visible)

    payload={"p_other_user_id":PEER,"p_reason_code":1,
        "p_details":"Native self-hosted Auth + report RPC integration",
        "p_message_ids":[message],"p_idempotency_key":str(uuid.uuid4())}
    code,report=http(REST,"POST","/rpc/xoxo_submit_conversation_report_beta",payload,token)
    assert code==200 and isinstance(report,str),(
        "Native Auth session denied report RPC",code,report)
    report_id=str(uuid.UUID(report))
    assert db("select count(*) from xoxo_safety_private.conversation_reports "
      f"where reporter_id='{user}'::uuid and id='{report_id}'::uuid") == "1"
    assert db("select count(*) from xoxo_safety_private.conversation_report_evidence "
      f"where report_id='{report_id}'::uuid") == "1"

    # Simulate session revocation in the SAME native Auth DB, while the JWT
    # is still cryptographically valid; no real credentials are involved.
    db(f"delete from auth.sessions where id='{session_id}'::uuid")
    payload["p_idempotency_key"]=str(uuid.uuid4())
    code,denied=http(REST,"POST","/rpc/xoxo_submit_conversation_report_beta",payload,token)
    assert code in (400,401,403,404,406),(
      "A revoked native Auth session submitted a report",code,denied)
    assert db("select count(*) from xoxo_safety_private.conversation_reports "
      f"where reporter_id='{user}'::uuid") == "1"
    print("PASS: genuine GoTrue session stored and checked in SAME disposable DB; "
          "RLS, report RPC, evidence and native session revocation denied safely")


if __name__=="__main__":run()
