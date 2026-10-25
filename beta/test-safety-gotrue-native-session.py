#!/usr/bin/env python3
"""Real GoTrue-issued session read from its native Auth table by report RPC.

This test has no session mirroring: GoTrue and PostgREST use the SAME
DISPOSABLE xoxo_gotrue_ci database. Synthetic messages and local JWT key only.
"""
import json
import os
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


def js_report_pipeline(phase,token,outsider_token,message,user,outsider_user):
    """Exercise the ACTUAL JavaScript submit entry point over loopback HTTP.

    Pass JWTs on stdin only; never print, persist or put them on argv.
    """
    payload={"phase":phase,"token":token,"outsiderToken":outsider_token,
        "messageId":message,"otherUserId":PEER,
        "idempotencyKey":str(uuid.uuid4()),
        "browserIdempotencyKey":str(uuid.uuid4()),
        "expectedUserId":user,"outsiderUserId":outsider_user,
        "outsiderIdempotencyKey":str(uuid.uuid4())}
    result=subprocess.run(["node","beta/test-safety-native-js-client.cjs"],
        input=json.dumps(payload),text=True,capture_output=True,timeout=35)
    if result.returncode:
        raise AssertionError("Native JS report integration failed: "+result.stderr[:900])
    assert result.stdout.startswith("PASS:"),"JS pipeline did not finish its assertions"
    print(result.stdout.strip())


def real_browser_report_flow(token,message,user):
    """Run actual XOXO form and evidence DOM with real local Auth/RLS.

    Only the synthetic JWT is supplied via stdin; Node's loopback-only HTTP
    proxy keeps both browsers on one origin without external CORS requests.
    """
    result=subprocess.run(["node","beta/test-safety-native-browser-e2e.cjs"],
        input=json.dumps({"token":token,"user":user,"peer":PEER,
            "messageId":message}),text=True,capture_output=True,timeout=240)
    if result.returncode:
        raise AssertionError("Native browser-to-RPC integration failed: "+result.stderr[:1000])
    assert "PASS: webkit real DOM" in result.stdout
    assert "PASS: chromium real DOM" in result.stdout
    print(result.stdout.strip())


def native_admin_moderation_queue(reporter_token,admin_token,admin_user,
                                  admin_session_id,report_id,expected_reports):
    """Prove PIN + admin role + active GoTrue session guard the real RPCs.

    This is the existing moderator's metadata queue, NOT a second DM viewer.
    All grants, verification windows, reports and audits are disposable.
    """
    reason="Review of synthetic conversation safety reports"
    listing="/rpc/xoxo_admin_list_conversation_reports_beta"
    update="/rpc/xoxo_admin_update_conversation_report_beta"
    page="/rpc/xoxo_admin_page_conversation_reports_beta"
    list_body={"p_reason":reason}

    # A genuine member cannot browse the queue, even with a valid JWT.
    code,_=http(REST,"POST",listing,list_body,reporter_token)
    assert code in (400,401,403),("Member read moderator queue",code)
    code,_=http(REST,"POST",listing,list_body,admin_token)
    assert code in (400,401,403),("Non-admin read moderator queue",code)

    db("insert into public.xoxo_admins(user_id) "
       f"values ('{admin_user}'::uuid)")
    code,_=http(REST,"POST",listing,list_body,admin_token)
    assert code in (400,401,403),("Admin skipped mandatory PIN",code)
    db("insert into public.xoxo_moderation_pin_security "
       "(admin_id,verified_until,locked_until) values "
       f"('{admin_user}'::uuid,now()+interval '10 minutes',null)")
    code,_=http(REST,"POST",listing,{"p_reason":"too short"},admin_token)
    assert code in (400,401,403),("Admin skipped moderation reason",code)

    code,rows=http(REST,"POST",listing,list_body,admin_token)
    assert code==200 and isinstance(rows,list) and len(rows)==expected_reports,(
        "PIN-authorized report queue missing real stored reports",code,rows)
    assert any(r.get("id")==report_id for r in rows)
    assert all(len(r.get("message_ids",[]))==1 and
        r.get("unavailable_evidence_count")==0 for r in rows)
    assert all(not any(key in r for key in
        ("content","message_content","message_text","body","attachment_url"))
        for r in rows),"Report queue leaked private message content"
    assert db("select count(*) from public.xoxo_message_access_log "
      f"where admin_id='{admin_user}'::uuid and "
      f"action like 'conversation_report_queue:view count={expected_reports}:%'") == "1",(
      "Existing moderator audit did not log queue access")

    # Verify server-side cursor paging; every page must itself be PIN-checked
    # and audited, with no cross-page duplicate or unbounded result.
    cursor=None
    seen=set()
    for index in range((expected_reports+1)//2+1):
        page_body={"p_reason":reason,"p_after_pending":None,
            "p_after_created_at":None,"p_after_id":None,"p_limit":2}
        if cursor:
            page_body.update({"p_after_pending":cursor["pending"],
                "p_after_created_at":cursor["created_at"],
                "p_after_id":cursor["id"]})
        code,batch=http(REST,"POST",page,page_body,admin_token)
        assert code==200 and isinstance(batch,dict),(
            "Admin report page unavailable",code,batch)
        results=batch.get("reports")
        assert isinstance(results,list) and len(results)<=2
        assert not seen.intersection(r["id"] for r in results),(
            "Admin queue returned duplicate report across pages",index)
        seen.update(r["id"] for r in results)
        cursor=batch.get("next_cursor")
        if not batch.get("has_more"):
            assert cursor is None
            break
        assert isinstance(cursor,dict)
    assert seen=={r["id"] for r in rows},("Incomplete admin pagination",seen)
    assert db("select count(*) from public.xoxo_message_access_log "
      f"where admin_id='{admin_user}'::uuid and "
      "action like 'conversation_report_page:view count=%'") == str(
        (expected_reports+1)//2)

    update_body={"p_report_id":report_id,"p_status":"reviewed",
        "p_reason":reason}
    code,updated=http(REST,"POST",update,update_body,admin_token)
    assert code==200 and updated is True,(
        "PIN-authorized report status update failed",code,updated)
    assert db("select status from xoxo_safety_private.conversation_reports "
      f"where id='{report_id}'::uuid") == "reviewed"
    assert db("select count(*) from public.xoxo_message_access_log "
      f"where action like 'conversation_report_status:reviewed: report={report_id}%'") == "1"

    db("update public.xoxo_moderation_pin_security "
       "set verified_until=now()-interval '1 minute' "
       f"where admin_id='{admin_user}'::uuid")
    for route,body in ((listing,list_body),(update,update_body),
        (page,{"p_reason":reason,"p_after_pending":None,
            "p_after_created_at":None,"p_after_id":None,"p_limit":2})):
        code,_=http(REST,"POST",route,body,admin_token)
        assert code in (400,401,403),(
            "Expired PIN accessed or mutated private report metadata",route,code)
    assert db("select status from xoxo_safety_private.conversation_reports "
      f"where id='{report_id}'::uuid") == "reviewed"

    # Even if the PIN still looks verified, revoking the native Auth session
    # must immediately invalidate this SECURITY DEFINER metadata RPC.
    db("update public.xoxo_moderation_pin_security "
       "set verified_until=now()+interval '10 minutes' "
       f"where admin_id='{admin_user}'::uuid")
    db(f"delete from auth.sessions where id='{admin_session_id}'::uuid")
    code,_=http(REST,"POST",listing,list_body,admin_token)
    assert code in (400,401,403),(
        "Revoked genuine admin session read PIN-protected reports",code)
    print("PASS: real GoTrue admin/moderator session -> PIN-gated queue, "
          "existing audit, cursor pages, status changes, expired PIN and "
          f"revoked-session denial; {expected_reports} fictional reports")


def run():
    quick_admin=os.environ.get("XOXO_SAFETY_NATIVE_QUICK_ADMIN")=="1"
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

    # A second ACTUAL GoTrue sign-in must not read or report the first
    # member's private DM evidence, even though both tokens are valid.
    outsider_email="xoxo-outsider-"+uuid.uuid4().hex[:12]+"@example.invalid"
    outsider_password="NativeOutsiderOnly!"+uuid.uuid4().hex[:18]
    code,outsider_auth=http(AUTH,"POST","/signup",
        {"email":outsider_email,"password":outsider_password})
    assert code in (200,201),("Second GoTrue signup failed",code,outsider_auth)
    outsider_token=outsider_auth.get("access_token")
    if not outsider_token:
        code,outsider_auth=http(AUTH,"POST","/token?grant_type=password",
            {"email":outsider_email,"password":outsider_password})
        assert code==200,("Second GoTrue login failed",code,outsider_auth)
        outsider_token=outsider_auth.get("access_token")
    assert isinstance(outsider_token,str)
    outsider_middle=outsider_token.split(".")[1]
    outsider_claims=json.loads(base64.urlsafe_b64decode(outsider_middle+
        "="*((4-len(outsider_middle)%4)%4)))
    outsider_user=str(uuid.UUID(outsider_claims["sub"]))
    outsider_session_id=str(uuid.UUID(outsider_claims["session_id"]))
    code,outsider_visible=http(REST,"GET","/direct_messages?select=id",
        token=outsider_token)
    assert code==200 and all(row.get("id")!=message for row in outsider_visible),(
        "Unrelated real Auth user could see private evidence",code,outsider_visible)
    outsider_payload={**payload,"p_idempotency_key":str(uuid.uuid4())}
    code,denied_other=http(REST,"POST",
        "/rpc/xoxo_submit_conversation_report_beta",outsider_payload,outsider_token)
    assert code in (400,401,403,404,406),(
        "Unrelated real Auth user submitted another account's evidence",code,denied_other)
    assert db("select count(*) from xoxo_safety_private.conversation_reports") == "1",(
        "An unrelated account created a report despite invalid evidence")

    code,replayed=http(REST,"POST","/rpc/xoxo_submit_conversation_report_beta",
        payload,token)
    assert code==200 and replayed==report_id,(
        "Native Auth idempotent retry created another report",code,replayed)

    # Join the genuine signed Auth session to the actual JS report submission
    # modules, with a real RLS read and a real atomic PostgREST write. This
    # second synthetic report is distinct from the direct-HTTP test above.
    js_report_pipeline("active",token,outsider_token,message,user,outsider_user)
    if not quick_admin:
        real_browser_report_flow(token,message,user)
    expected_user_reports=4 if quick_admin else 6
    assert db("select count(*) from xoxo_safety_private.conversation_reports "
      f"where reporter_id='{user}'::uuid") == str(expected_user_reports)
    assert db("select count(*) from xoxo_safety_private.conversation_report_evidence e "
      "join xoxo_safety_private.conversation_reports r on r.id=e.report_id "
      f"where r.reporter_id='{user}'::uuid") == str(expected_user_reports)

    # Reuse the authenticated outsider after its denial as a disposable
    # administrator. This proves role and fixed-PIN checks on the actual
    # moderated report RPCs, not only on mocked frontend adapters.
    native_admin_moderation_queue(token,outsider_token,outsider_user,
        outsider_session_id,report_id,int(db(
            "select count(*) from xoxo_safety_private.conversation_reports")))

    # Simulate session revocation in the SAME native Auth DB, while the JWT
    # is still cryptographically valid; no real credentials are involved.
    db(f"delete from auth.sessions where id='{session_id}'::uuid")
    js_report_pipeline("revoked",token,outsider_token,message,user,outsider_user)
    payload["p_idempotency_key"]=str(uuid.uuid4())
    code,denied=http(REST,"POST","/rpc/xoxo_submit_conversation_report_beta",payload,token)
    assert code in (400,401,403,404,406),(
      "A revoked native Auth session submitted a report",code,denied)
    assert db("select count(*) from xoxo_safety_private.conversation_reports "
      f"where reporter_id='{user}'::uuid") == str(expected_user_reports)
    print("PASS: genuine GoTrue session checked in SAME disposable DB; "
          "RLS, report/evidence, JS submission, outsider denial, idempotency "
          "and revoked-session denial")


if __name__=="__main__":run()
