#!/usr/bin/env python3
"""Full cursor traversal over signed local PostgREST (synthetic CI only)."""
import base64
import hashlib
import hmac
import json
import os
import subprocess
import time
import urllib.error
import urllib.request

assert os.getenv("PGHOST") == "127.0.0.1"
assert os.getenv("PGDATABASE") == "xoxo_safety_test"
assert os.getenv("PGUSER") == "postgres"

URL="http://127.0.0.1:3001"
KEY=b"xoxo-local-ci-jwt-secret-not-for-production-1234567890"
ADMIN="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
SESSION="cccccccc-0000-4000-8000-000000000003"
REASON="Reviewing complete unresolved and resolved safety history"

def db(sql):
    completed=subprocess.run(
        ["psql","-XAtq","-v","ON_ERROR_STOP=1","-c",sql],
        text=True,capture_output=True,check=False,timeout=12
    )
    assert completed.returncode==0,completed.stderr[:350]
    return completed.stdout.strip()

def b64(x):return base64.urlsafe_b64encode(x).decode().rstrip("=")

def token(user=ADMIN,session=SESSION):
    header=b64(b'{"alg":"HS256","typ":"JWT"}')
    payload=b64(json.dumps({
        "role":"authenticated","sub":user,"session_id":session,
        "iat":int(time.time())-5,"exp":int(time.time())+300
    },separators=(",",":")).encode())
    value=header+"."+payload
    signature=b64(hmac.new(KEY,value.encode(),hashlib.sha256).digest())
    return value+"."+signature

def rpc(name,body,auth=True,override_token=None):
    headers={"Content-Type":"application/json","Accept":"application/json"}
    if auth:headers["Authorization"]="Bearer "+(override_token or token())
    req=urllib.request.Request(
        URL+"/rpc/"+name,headers=headers,
        data=json.dumps(body).encode(),method="POST"
    )
    try:
        with urllib.request.urlopen(req,timeout=9) as result:
            return result.status,json.loads(result.read().decode())
    except urllib.error.HTTPError as error:
        try:return error.code,json.loads(error.read().decode())
        except ValueError:return error.code,{}

def deny(status,label):
    assert status in (400,401,403,404,406),(label,status)

# The prior SQL test deliberately expired the PIN to test denial.
db("update public.xoxo_moderation_pin_security "
   "set verified_until=now()+interval '5 minutes',locked_until=null "
   f"where admin_id='{ADMIN}'::uuid")

expected=int(db("select count(*) from xoxo_safety_private.conversation_reports"))
assert expected>200,("Fixture must exceed 200 reports",expected)
audit_before=int(db("select count(*) from public.xoxo_message_access_log "
                    "where action like 'conversation_report_page:view count=%'"))

status,first=rpc("xoxo_admin_list_conversation_reports_beta",{"p_reason":REASON})
assert status==200 and isinstance(first,list) and len(first)==100,(status,len(first) if isinstance(first,list) else first)
seen=set()
last_sort=None
all_count=0
page_count=0
records=first

while True:
    for report in records:
        ident=report["id"]
        assert ident not in seen,"Duplicated report across real HTTP requests"
        seen.add(ident)
        current=(report["status"]=="pending",report["created_at"],ident)
        if last_sort is not None:
            assert current<last_sort,("Unordered cursor result",current,last_sort)
        last_sort=current
        assert "content" not in report and "attachment_path" not in report
        all_count+=1
    if all_count==100:
        more=True
    else:
        more=has_more
    if not more:
        break
    assert page_count<20,"Page cursor never terminated"
    end=records[-1]
    cursor={"pending":end["status"]=="pending",
            "created_at":end["created_at"],"id":end["id"]}
    arguments={
        "p_reason":REASON,"p_after_pending":cursor["pending"],
        "p_after_created_at":cursor["created_at"],
        "p_after_id":cursor["id"],"p_limit":50
    }
    status,response=rpc("xoxo_admin_page_conversation_reports_beta",arguments)
    assert status==200 and isinstance(response,dict),("Page RPC failed",status,response)
    assert isinstance(response.get("reports"),list),response
    assert isinstance(response.get("has_more"),bool),response
    records=response["reports"]
    has_more=response["has_more"]
    if has_more:
        assert 0<len(records)<=50 and isinstance(response["next_cursor"],dict)
        last=records[-1]
        assert response["next_cursor"]["id"]==last["id"]
        assert response["next_cursor"]["pending"]==(last["status"]=="pending")
    else:
        assert response["next_cursor"] is None
    page_count+=1

assert all_count==expected,("Missing records after HTTP pagination",all_count,expected)
assert page_count>=3,("Not enough HTTP continuation pages",page_count)
audit_after=int(db("select count(*) from public.xoxo_message_access_log "
                   "where action like 'conversation_report_page:view count=%'"))
assert audit_after==audit_before+page_count,("Not exactly one audit entry per page",audit_before,audit_after,page_count)

denials=[
 ("anonymous",False,None,{"p_reason":REASON,"p_after_pending":None,"p_after_created_at":None,"p_after_id":None,"p_limit":25}),
 ("wrong session",True,token(session="bbbbbbbb-0000-4000-8000-000000000002"),
  {"p_reason":REASON,"p_after_pending":None,"p_after_created_at":None,"p_after_id":None,"p_limit":25}),
 ("oversized page",True,None,{"p_reason":REASON,"p_after_pending":None,"p_after_created_at":None,"p_after_id":None,"p_limit":51}),
 ("incomplete cursor",True,None,{"p_reason":REASON,"p_after_pending":True,"p_after_created_at":None,"p_after_id":None,"p_limit":25}),
]
for label,auth,auth_token,arguments in denials:
    status,_=rpc("xoxo_admin_page_conversation_reports_beta",
                 arguments,auth=auth,override_token=auth_token)
    deny(status,label)

db("update public.xoxo_moderation_pin_security "
   "set verified_until=now()-interval '1 minute' "
   f"where admin_id='{ADMIN}'::uuid")
status,_=rpc("xoxo_admin_page_conversation_reports_beta",
 {"p_reason":REASON,"p_after_pending":None,"p_after_created_at":None,"p_after_id":None,"p_limit":25})
deny(status,"expired PIN on subsequent report page")
assert int(db("select count(*) from public.xoxo_message_access_log "
              "where action like 'conversation_report_page:view count=%'"))==audit_after, (
                  "Denied HTTP pagination must not log a successful read"
              )
print("PASS: full signed HTTP pagination — "+str(all_count)+
      " unique reports in "+str(page_count+1)+
      " pages, private metadata and one audit per page, no expired PIN bypass")
