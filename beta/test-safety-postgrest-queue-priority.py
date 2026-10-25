#!/usr/bin/env python3
"""Check the 100-card pending-first admin queue through the real local HTTP API.
Run AFTER sql-test-admin-queue-priority.sql, exclusively in disposable CI.
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

assert os.getenv("PGHOST") == "127.0.0.1"
assert os.getenv("PGDATABASE") == "xoxo_safety_test"
assert os.getenv("PGUSER") == "postgres"

BASE = "http://127.0.0.1:3001"
KEY = b"xoxo-local-ci-jwt-secret-not-for-production-1234567890"
ADMIN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
SESSION = "cccccccc-0000-4000-8000-000000000003"
REASON = "Reviewing old unresolved cases after a reporting surge"


def encode(raw):
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def jwt():
    header = encode(b'{"alg":"HS256","typ":"JWT"}')
    claims = encode(json.dumps({
        "role": "authenticated", "sub": ADMIN, "session_id": SESSION,
        "iat": int(time.time()) - 2, "exp": int(time.time()) + 180
    }, separators=(",", ":")).encode())
    body = (header + "." + claims).encode()
    signature = encode(hmac.new(KEY, body, hashlib.sha256).digest())
    return header + "." + claims + "." + signature


def audit_count():
    query = ("select count(*) from public.xoxo_message_access_log "
             "where admin_id='" + ADMIN + "'::uuid "
             "and action like 'conversation_report_queue:view count=100:%'")
    completed = subprocess.run(
        ["psql", "-XAtq", "-v", "ON_ERROR_STOP=1", "-c", query],
        text=True, capture_output=True, timeout=10, check=False
    )
    assert completed.returncode == 0, completed.stderr
    return int(completed.stdout.strip())


before = audit_count()
req = urllib.request.Request(
    BASE + "/rpc/xoxo_admin_list_conversation_reports_beta",
    headers={"Content-Type": "application/json",
             "Authorization": "Bearer " + jwt(), "Accept": "application/json"},
    data=json.dumps({"p_reason": REASON}).encode(), method="POST"
)
try:
    with urllib.request.urlopen(req, timeout=8) as result:
        assert result.status == 200, "Admin API should return HTTP 200"
        reports = json.loads(result.read().decode())
except urllib.error.HTTPError as error:
    raise AssertionError("Admin API failed HTTP " + str(error.code) +
                         ": " + error.read().decode()[:400]) from error

assert isinstance(reports, list) and len(reports) == 100, (
    "Admin API must deliver 100 limited report metadata cards"
)
pending_positions = [i for i, item in enumerate(reports)
                     if item["status"] == "pending"]
closed_positions = [i for i, item in enumerate(reports)
                    if item["status"] != "pending"]
assert pending_positions and closed_positions, "Need both status groups"
assert max(pending_positions) < min(closed_positions), (
    "Pending report was hidden after a newer closed report"
)
old_cases = [item for item in reports
             if item.get("details", "").startswith("queue_priority_old_pending_")]
assert len(old_cases) == 3, "All 3 95-day-old unresolved reports must survive limit"
for item in reports:
    assert "content" not in item and "attachment_path" not in item, (
        "Report queue must not expose private direct-message bodies"
    )
assert audit_count() == before + 1, (
    "Each successful HTTP queue read must be audited exactly once"
)
print("PASS: signed PostgREST HTTP returns all 3 very old pending reports "
      "before newer closed cases, exactly 100 cards and one access audit")
