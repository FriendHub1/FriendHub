#!/usr/bin/env bash
# Disposable PostgreSQL only. Two independent sessions test row locking.
set -euo pipefail
test "${PGHOST:-}" = "127.0.0.1"
test "${PGDATABASE:-}" = "xoxo_reveal_test_ci"
test "${PGUSER:-}" = "xoxo_test"
psql -X -v ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE IF NOT EXISTS public.xoxo_refund_concurrency_fixture (
 id integer PRIMARY KEY, released boolean NOT NULL DEFAULT false
);
INSERT INTO public.xoxo_refund_concurrency_fixture(id,released)
VALUES (1,false) ON CONFLICT(id) DO UPDATE SET released=false;
SQL
# Session A holds the quota row lock while session B attempts NOWAIT.
psql -X -v ON_ERROR_STOP=1 <<'SQL' > /tmp/xoxo-refund-lock-holder.log 2>&1 &
BEGIN;
SELECT id FROM public.xoxo_refund_concurrency_fixture WHERE id=1 FOR UPDATE;
SELECT pg_sleep(4);
UPDATE public.xoxo_refund_concurrency_fixture SET released=true WHERE id=1;
COMMIT;
SQL
holder=$!
trap 'wait "$holder" 2>/dev/null || true' EXIT
sleep 1
# Lock acquisition must fail while session A owns the row.
if psql -X -v ON_ERROR_STOP=1 <<'SQL' >/tmp/xoxo-refund-contender.log 2>&1
BEGIN;
SELECT id FROM public.xoxo_refund_concurrency_fixture WHERE id=1 FOR UPDATE NOWAIT;
ROLLBACK;
SQL
then
 echo "ERROR: concurrent session acquired locked quota row" >&2
 exit 1
fi
grep -q 'could not obtain lock on row' /tmp/xoxo-refund-contender.log
wait "$holder"
trap - EXIT
# Once committed, another session sees released=true and cannot claim an
# active quota. This is a fixture, not the real refund SQL migration.
test "$(psql -X -At -v ON_ERROR_STOP=1 -c 'SELECT released FROM public.xoxo_refund_concurrency_fixture WHERE id=1')" = 't'
psql -X -v ON_ERROR_STOP=1 -c 'DROP TABLE public.xoxo_refund_concurrency_fixture'
echo 'Isolated concurrent quota row-lock test passed.'
