#!/usr/bin/env python3
"""XOXO BETA: concurrent isolated PostgreSQL security checks, NEVER production.
Run only after CI creates fixtures, installs BETA SQL and passes sequential tests.
Uses Python's standard library and the local PostgreSQL 17 GitHub Actions service.
"""
import concurrent.futures
import os
import re
import subprocess

assert os.environ.get("PGHOST") == "127.0.0.1", "Local database host required"
assert os.environ.get("PGDATABASE") == "xoxo_safety_test", "Disposable database required"
assert os.environ.get("PGUSER") == "postgres", "Disposable PostgreSQL user required"

A = "33333333-3333-4333-8333-333333333333"
B = "22222222-2222-4222-8222-222222222222"
MESSAGE = "77777777-7777-4777-8777-777777777773"
UUID_PATTERN = re.compile(r"^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$")


def sql(query):
    return subprocess.run(
        ["psql", "-XAtq", "-v", "ON_ERROR_STOP=1", "-c", query],
        text=True, capture_output=True, check=False, timeout=25
    )


def count(query):
    result = sql(query)
    if result.returncode:
        raise AssertionError(f"Count query failed: {result.stderr.strip()}")
    return int(result.stdout.strip())


def submit(reporter, peer, key, details):
    # All inputs are constants synthesized by this test (never untrusted text).
    query = (
        "SET ROLE authenticated;"
        f"SELECT set_config('request.jwt.claim.sub','{reporter}',false);"
        "SELECT public.xoxo_submit_conversation_report_beta("
        f"'{peer}'::uuid,0,'{details}',"
        f"ARRAY['{MESSAGE}'::uuid],'{key}'::uuid);"
    )
    result = sql(query)
    if result.returncode:
        return {"ok": False, "error": result.stderr}
    values = [x.strip() for x in result.stdout.splitlines() if x.strip()]
    assert values and UUID_PATTERN.fullmatch(values[-1]), "Invalid RPC report ID"
    return {"ok": True, "id": values[-1]}


# 12 concurrent unique reports must produce exactly 10 inserts and 2 rate-limit
# errors; otherwise the advisory transaction lock is not effective.
keys = [f"99999999-9999-4999-8999-{i:012d}" for i in range(1, 13)]
with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
    futures = [pool.submit(submit, A, B, key, "Parallel report") for key in keys]
    rate_results = [future.result() for future in futures]

successes = [(key, result["id"]) for key, result in zip(keys, rate_results) if result["ok"]]
denials = [result for result in rate_results if not result["ok"]]
assert len(successes) == 10 and len(denials) == 2, (
    f"Rate limit expected 10 success and 2 denied, got {len(successes)} and {len(denials)}"
)
assert all("Daily report limit reached" in result["error"] for result in denials), (
    "Unexpected error in concurrent report attempt"
)
assert count(
    f"SELECT count(*) FROM xoxo_safety_private.conversation_reports WHERE reporter_id='{A}'::uuid"
) == 10, "More or fewer than 10 report rows persisted"
assert count(
    "SELECT count(*) FROM xoxo_safety_private.conversation_report_evidence e "
    "JOIN xoxo_safety_private.conversation_reports r ON r.id=e.report_id "
    f"WHERE r.reporter_id='{A}'::uuid"
) == 10, "Evidence must be persisted atomically"

# Eight simultaneous requests with a shared idempotency key are allowed but
# must all return the SAME existing report ID and write exactly one report.
key = "99999999-9999-4999-8999-999999999999"
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
    futures = [pool.submit(submit, B, A, key, "Concurrent retry") for _ in range(8)]
    retries = [future.result() for future in futures]

assert all(item["ok"] for item in retries), "Identical retry request unexpectedly failed"
ids = {item["id"] for item in retries}
assert len(ids) == 1, "Concurrent identical retries created separate reports"
shared_id = ids.pop()
assert count(
    "SELECT count(*) FROM xoxo_safety_private.conversation_reports "
    f"WHERE reporter_id='{B}'::uuid AND idempotency_key='{key}'::uuid"
) == 1, "Duplicate idempotency-key report rows created"
assert count(
    "SELECT count(*) FROM xoxo_safety_private.conversation_report_evidence "
    f"WHERE report_id='{shared_id}'::uuid"
) == 1, "Duplicate idempotent evidence rows created"

# When a user has already reached the daily limit, retrying the exact
# previously accepted report must still return its original report ID.
first_key, first_id = successes[0]
resumed = submit(A, B, first_key, "Parallel report")
assert resumed["ok"] and resumed["id"] == first_id, (
    "A completed submission cannot be retried after quota is reached"
)

print("PASS: real PostgreSQL concurrency — 12 parallel submissions (10 accepted), "
      "8 idempotent retries (1 report), evidence atomicity and retry after quota")
