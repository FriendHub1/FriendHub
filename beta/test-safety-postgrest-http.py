#!/usr/bin/env python3
"""HTTP + signed JWT integration test for a DISPOSABLE local PostgREST 12 / PG17.
Uses only synthetic users and a hard-coded local CI signing key. No Supabase API,
production secret, networked Supabase endpoint, or real messages are involved.
"""
import base64
import hashlib
import hmac
import json
import os
import subprocess
import time
import urllib.error
import urllib.request

HOST = "http://127.0.0.1:3001"
SECRET = b"xoxo-local-ci-jwt-secret-not-for-production-1234567890"
U = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"  # reporter
PEER = "ffffffff-ffff-4fff-8fff-ffffffffffff"
OUT = "99999999-8888-4777-8666-555555555555"
ADMIN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
SES_U = "aaaa0000-0000-4000-8000-000000000001"
SES_PEER = "bbbb0000-0000-4000-8000-000000000002"
SES_OUT = "cccc0000-0000-4000-8000-000000000003"
SES_ADMIN = "cccccccc-0000-4000-8000-000000000003"
MSG = "88888888-8888-4888-8888-888888888881"
OTHER_MSG = "88888888-8888-4888-8888-888888888882"
KEY = "abababab-abab-4bab-8bab-ababababab01"
REASON = "Reviewed a safety report received from this chat."
valid_id = lambda s: isinstance(s, str) and len(s) == 36 and s.count("-") == 4

assert os.environ.get("PGHOST") == "127.0.0.1"
assert os.environ.get("PGDATABASE") == "xoxo_safety_test"
assert os.environ.get("PGUSER") == "postgres"


def b64(data):
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def token(user, session, *, exp=None, key=SECRET):
    header = b64(b'{"alg":"HS256","typ":"JWT"}')
    payload = b64(json.dumps({
        "role": "authenticated", "sub": user, "session_id": session,
        "iat": int(time.time()) - 5,
        "exp": int(time.time()) + 300 if exp is None else exp
    }, separators=(",", ":")).encode())
    payload_to_sign = (header + "." + payload).encode()
    signature = b64(hmac.new(key, payload_to_sign, hashlib.sha256).digest())
    return header + "." + payload + "." + signature


def request(method, url, jwt=None, payload=None):
    headers = {"Accept": "application/json"}
    if jwt is not None:
        headers["Authorization"] = "Bearer " + jwt
    data = None
    if payload is not None:
        data = json.dumps(payload, separators=(",", ":")).encode()
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(HOST + url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=8) as res:
            return res.status, json.loads(res.read().decode() or "null")
    except urllib.error.HTTPError as error:
        body = error.read().decode()
        try:
            body = json.loads(body)
        except ValueError:
            body = {"raw": body[:500]}
        return error.code, body


def db(sql):
    res = subprocess.run(
        ["psql", "-XAtq", "-v", "ON_ERROR_STOP=1", "-c", sql],
        capture_output=True, text=True, timeout=10, check=False,
    )
    if res.returncode:
        raise AssertionError("Disposable database fixture update failed: " + res.stderr[:350])
    return res.stdout.strip()


def blocked(status, label):
    assert status in (400, 401, 403, 404), f"{label}: expected denial, got HTTP {status}"


def rpc_payload(other=PEER, evidence=None, key=KEY, reason=0, details="Suspicious request"):
    return {
        "p_other_user_id": other,
        "p_reason_code": reason,
        "p_details": details,
        "p_message_ids": [MSG] if evidence is None else evidence,
        "p_idempotency_key": key,
    }


def check():
    reporter = token(U, SES_U)
    outsider = token(OUT, SES_OUT)
    administrator = token(ADMIN, SES_ADMIN)

    status, _ = request("POST", "/rpc/xoxo_submit_conversation_report_beta",
                        payload=rpc_payload())
    blocked(status, "anonymous RPC")

    status, _ = request("POST", "/rpc/xoxo_submit_conversation_report_beta",
                        token(U, SES_U, key=b"wrong-secret-that-is-also-at-least-32-characters"),
                        rpc_payload())
    blocked(status, "wrong JWT signature")

    status, _ = request("POST", "/rpc/xoxo_submit_conversation_report_beta",
                        token(U, SES_U, exp=int(time.time()) - 60),
                        rpc_payload())
    blocked(status, "expired JWT")

    status, body = request("GET", "/direct_messages?select=id", reporter)
    assert status == 200 and sorted(x["id"] for x in body) == [MSG, OTHER_MSG], (
        "PostgREST/RLS did not return exactly the pair's private messages", status, body)

    status, body = request("GET", "/direct_messages?select=id", outsider)
    assert status == 200 and body == [], ("RLS revealed other users' DMs", status, body)

    status, _ = request("GET", "/conversation_reports?select=id", reporter)
    blocked(status, "private reports table")

    status, _ = request("GET", "/auth.sessions?select=id", reporter)
    blocked(status, "Auth sessions table")
    # The auth schema is not exposed by this PostgREST instance, even when
    # a client manually requests it via a profile header.
    auth_req = urllib.request.Request(
        HOST + "/sessions?select=id",
        headers={"Authorization": "Bearer " + reporter,
                 "Accept": "application/json", "Accept-Profile": "auth"},
        method="GET")
    try:
        with urllib.request.urlopen(auth_req, timeout=8) as response:
            raise AssertionError("Auth sessions were exposed over HTTP: "
                                 + str(response.status))
    except urllib.error.HTTPError as error:
        blocked(error.code, "auth schema profile")

    status, _ = request("POST", "/rpc/xoxo_submit_conversation_report_beta",
                        outsider, rpc_payload())
    blocked(status, "wrong participant")

    status, _ = request("POST", "/rpc/xoxo_submit_conversation_report_beta",
                        token(U, SES_PEER), rpc_payload())
    blocked(status, "signed JWT with another person's session")

    status, _ = request("POST", "/rpc/xoxo_submit_conversation_report_beta",
                        reporter, rpc_payload(evidence=[MSG, MSG]))
    blocked(status, "duplicate evidence")

    status, _ = request("POST", "/rpc/xoxo_submit_conversation_report_beta",
                        reporter, rpc_payload(evidence=[MSG] * 21))
    blocked(status, "more than 20 evidence messages")

    status, report = request("POST", "/rpc/xoxo_submit_conversation_report_beta",
                             reporter, rpc_payload())
    assert status == 200 and valid_id(report), ("valid HTTP submission failed", status, report)

    status, retry = request("POST", "/rpc/xoxo_submit_conversation_report_beta",
                            reporter, rpc_payload())
    assert status == 200 and retry == report, "HTTP retry did not return same report id"

    status, _ = request("POST", "/rpc/xoxo_submit_conversation_report_beta",
                        reporter, rpc_payload(details="Different content"))
    blocked(status, "reused idempotency key with different body")

    # PIN alone does not authorize users who are not the administrator.
    status, _ = request("POST", "/rpc/xoxo_admin_list_conversation_reports_beta",
                        reporter, {"p_reason": REASON})
    blocked(status, "user accessing admin report queue")

    status, _ = request("POST", "/rpc/xoxo_admin_list_conversation_reports_beta",
                        token(ADMIN, SES_PEER), {"p_reason": REASON})
    blocked(status, "admin JWT with wrong session")

    status, queue = request("POST", "/rpc/xoxo_admin_list_conversation_reports_beta",
                            administrator, {"p_reason": REASON})
    assert status == 200 and isinstance(queue, list), ("PIN-gated admin queue failed", status, queue)
    matching = [item for item in queue if item.get("id") == report]
    assert len(matching) == 1 and matching[0]["reason_code"] == 0, (
        "admin queue did not include the HTTP report", status, queue)
    assert "content" not in matching[0], "admin metadata must not include full private message text"

    status, changed = request("POST", "/rpc/xoxo_admin_update_conversation_report_beta",
                              administrator,
                              {"p_report_id": report, "p_status": "reviewed", "p_reason": REASON})
    assert status == 200 and changed is True, ("audited admin status change failed", status, changed)

    audit_rows = db(
        "select count(*) from public.xoxo_message_access_log "
        "where action like 'conversation_report_status:reviewed:%' "
        f"and conversation_user_1=least('{U}'::uuid,'{PEER}'::uuid)")
    assert int(audit_rows) == 1, "admin moderation status change was not audited"

    # A user's own chat-clear state must hide evidence from that user while
    # preserving its existing moderation record for the administrator.
    db("insert into public.dm_conversation_clears "
       "(user_id,other_user_id,cleared_at) values "
       f"('{U}'::uuid,'{PEER}'::uuid,now())")
    status, cleared_rows = request("GET", "/direct_messages?select=id", reporter)
    assert status == 200 and cleared_rows == [], (
        "Cleared messages are still visible to the reporting user", status, cleared_rows)
    status, peer_rows = request("GET", "/direct_messages?select=id", token(PEER, SES_PEER))
    assert status == 200 and len(peer_rows) == 2, (
        "Clearing one side must not erase the other participant's history", status, peer_rows)
    status, _ = request("POST", "/rpc/xoxo_submit_conversation_report_beta",
                        reporter, rpc_payload(evidence=[OTHER_MSG],
                        key="abababab-abab-4bab-8bab-ababababab03"))
    blocked(status, "cleared chat evidence")
    assert db("select count(*) from xoxo_safety_private.conversation_reports "
              f"where reporter_id='{U}'::uuid") == "1", (
                  "Cleared evidence unexpectedly created another report")

    # Remove this synthetic session to test revocation with an otherwise valid JWT.
    db(f"delete from auth.sessions where id='{SES_U}'::uuid")
    status, _ = request("POST", "/rpc/xoxo_submit_conversation_report_beta",
                        reporter, rpc_payload(key="abababab-abab-4bab-8bab-ababababab02"))
    blocked(status, "revoked Auth session still in a signed JWT")

    assert db(
        "select count(*) from xoxo_safety_private.conversation_reports "
        f"where reporter_id='{U}'::uuid") == "1", "denied requests persisted reports"

    # The administrator must lose access when the existing PIN times out.
    db("update public.xoxo_moderation_pin_security "
       "set verified_until=now()-interval '1 minute' "
       f"where admin_id='{ADMIN}'::uuid")
    status, _ = request("POST", "/rpc/xoxo_admin_list_conversation_reports_beta",
                        administrator, {"p_reason": REASON})
    blocked(status, "admin PIN expiry")
    status, _ = request("POST", "/rpc/xoxo_admin_update_conversation_report_beta",
                        administrator,
                        {"p_report_id": report, "p_status": "dismissed", "p_reason": REASON})
    blocked(status, "admin status update after PIN expiry")
    db("update public.xoxo_moderation_pin_security "
       "set verified_until=now()+interval '10 minutes',"
       "locked_until=now()+interval '10 minutes' "
       f"where admin_id='{ADMIN}'::uuid")
    status, _ = request("POST", "/rpc/xoxo_admin_list_conversation_reports_beta",
                        administrator, {"p_reason": REASON})
    blocked(status, "admin PIN lockout")
    status, _ = request("POST", "/rpc/xoxo_admin_update_conversation_report_beta",
                        administrator,
                        {"p_report_id": report, "p_status": "dismissed", "p_reason": REASON})
    blocked(status, "admin status update during PIN lockout")
    assert db(
        "select status from xoxo_safety_private.conversation_reports "
        f"where id='{report}'::uuid") == "reviewed", (
            "A denied PIN status update modified a report")
    print("PASS: 23 local HTTP/JWT/PostgREST checks — real signed API requests, "
          "chat clears, denied revoked session, private data, idempotency, PIN expiry/lockout + audit")


if __name__ == "__main__":
    check()
