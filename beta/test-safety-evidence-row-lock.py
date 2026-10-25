#!/usr/bin/env python3
"""Prove Postgres FOR SHARE blocks DM non-key updates in disposable CI only.

The safety RPC's SQL contract separately requires FOR SHARE on the validated
DM rows. This real two-connection PostgreSQL test demonstrates WHY: row fields
used as evidence must not change during a report's atomic transaction.
"""
import os
import subprocess
import time

assert os.environ.get("PGHOST") == "127.0.0.1", "Never run outside local CI"
assert os.environ.get("PGDATABASE") == "xoxo_safety_test", "Disposable DB only"
assert os.environ.get("PGUSER") == "postgres", "Disposable PG superuser only"

MSG = "66666666-6666-4666-8666-666666666666"
A = "11111111-1111-4111-8111-111111111111"
B = "22222222-2222-4222-8222-222222222222"
MARKER = "xoxo_evidence_row_lock_wait_marker_26"


def query(sql, timeout=12):
    return subprocess.run(
        ["psql", "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c", sql],
        capture_output=True, text=True, timeout=timeout, check=False
    )


def read(sql):
    result = query(sql)
    assert result.returncode == 0, result.stderr[:500]
    return result.stdout.strip()


assert read("select current_database()") == "xoxo_safety_test"
assert read(
    "select count(*) from public.direct_messages "
    f"where id='{MSG}'::uuid"
) == "0", "Test's unique DM ID already exists"

insert = query(
    "insert into public.direct_messages "
    "(id,sender_id,recipient_id,content,created_at) values "
    f"('{MSG}'::uuid,'{A}'::uuid,'{B}'::uuid,"
    "'Untampered synthetic evidence',now()-interval '2 days')"
)
assert insert.returncode == 0, insert.stderr[:500]

lock_session = None
try:
    # The first connection retains FOR SHARE through pg_sleep; the second
    # connection must time out while trying either non-key UPDATE.
    statement = (
        "begin;"
        "set local lock_timeout='2s';"
        f"select id from public.direct_messages where id='{MSG}'::uuid for share;"
        f"select pg_sleep(4) /* {MARKER} */;"
        "commit;"
    )
    lock_session = subprocess.Popen(
        ["psql", "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c", statement],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
    )

    # Synchronize on PostgreSQL's actual waiting state rather than assuming
    # timings; by PgSleep, the FOR SHARE lock has already been acquired.
    ready = False
    for _ in range(45):
        if lock_session.poll() is not None:
            break
        active = read(
            "select count(*) from pg_stat_activity "
            "where datname=current_database() "
            "and wait_event='PgSleep' "
            f"and query like '%{MARKER}%'"
        )
        if int(active) >= 1:
            ready = True
            break
        time.sleep(0.08)
    assert ready, "Evidence locker never entered PostgreSQL PgSleep"

    for field_update in (
        "content='Corrupted synthetic message'",
        "created_at=created_at + interval '1 hour'",
        f"recipient_id='{A}'::uuid",
    ):
        attempted = query(
            "set lock_timeout='300ms';"
            f"update public.direct_messages set {field_update} "
            f"where id='{MSG}'::uuid"
        )
        assert attempted.returncode != 0, (
            "FOR SHARE failed to protect reported DM from " + field_update
        )
        assert "lock timeout" in attempted.stderr.lower(), (
            "Unexpected error instead of required row lock: "
            + attempted.stderr[-400:]
        )

    output, errors = lock_session.communicate(timeout=12)
    assert lock_session.returncode == 0, (
        "Evidence lock holding transaction failed: " + errors[-500:]
    )
    assert MSG in output, "The evidence row was never acquired FOR SHARE"

    # None of the attempted changes may leak through on the second connection.
    assert read(
        "select content from public.direct_messages "
        f"where id='{MSG}'::uuid"
    ) == "Untampered synthetic evidence"
    assert read(
        "select count(*) from public.direct_messages "
        f"where id='{MSG}'::uuid and sender_id='{A}'::uuid "
        f"and recipient_id='{B}'::uuid "
        "and created_at < now()-interval '1 day'"
    ) == "1", "Evidence sender/recipient/timestamp changed while locked"
    print(
        "PASS: real concurrent PostgreSQL FOR SHARE protects reported DM "
        "content, recipient and created_at against non-key updates"
    )
finally:
    if lock_session is not None and lock_session.poll() is None:
        lock_session.kill()
        lock_session.communicate(timeout=5)
    cleaned = query(
        f"delete from public.direct_messages where id='{MSG}'::uuid"
    )
    assert cleaned.returncode == 0, cleaned.stderr[:400]
