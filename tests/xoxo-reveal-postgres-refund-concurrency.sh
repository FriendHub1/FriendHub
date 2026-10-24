#!/usr/bin/env bash
# Disposable PostgreSQL only: deterministic two-session row lock contention.
set -euo pipefail
test "${PGHOST:-}" = "127.0.0.1"
test "${PGDATABASE:-}" = "xoxo_reveal_test_ci"
test "${PGUSER:-}" = "xoxo_test"
workdir="$(mktemp -d)"
export XOXO_LOCK_MARKER="$workdir/lock-acquired"
holder=''
cleanup() {
 if [[ -n "$holder" ]]; then kill "$holder" 2>/dev/null || true; wait "$holder" 2>/dev/null || true; fi
 rm -rf "$workdir"
}
trap cleanup EXIT
psql -X -v ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE IF NOT EXISTS public.xoxo_refund_concurrency_fixture (
 id integer PRIMARY KEY, released boolean NOT NULL DEFAULT false
);
INSERT INTO public.xoxo_refund_concurrency_fixture(id,released)
VALUES (1,false) ON CONFLICT(id) DO UPDATE SET released=false;
SQL
# The marker is emitted by psql only AFTER acquiring the row lock.
psql -X -v ON_ERROR_STOP=1 >"$workdir/holder.log" 2>&1 <<'SQL' &
BEGIN;
SELECT id FROM public.xoxo_refund_concurrency_fixture WHERE id=1 FOR UPDATE;
\! touch "$XOXO_LOCK_MARKER"
SELECT pg_sleep(5);
UPDATE public.xoxo_refund_concurrency_fixture SET released=true WHERE id=1 AND released=false;
COMMIT;
SQL
holder=$!
ready=0
for i in {1..100}; do
 if [[ -f "$XOXO_LOCK_MARKER" ]]; then ready=1; break; fi
 if ! kill -0 "$holder" 2>/dev/null; then break; fi
 sleep 0.05
done
if [[ "$ready" != 1 ]]; then cat "$workdir/holder.log" >&2; echo "Lock holder never acquired lock" >&2; exit 1; fi
# Independent session must fail NOWAIT while first transaction is active.
if psql -X -v ON_ERROR_STOP=1 >"$workdir/contender.log" 2>&1 <<'SQL'
BEGIN;
SELECT id FROM public.xoxo_refund_concurrency_fixture WHERE id=1 FOR UPDATE NOWAIT;
ROLLBACK;
SQL
then
 echo "ERROR: second session acquired locked quota row" >&2
 exit 1
fi
grep -q 'could not obtain lock on row' "$workdir/contender.log"
wait "$holder"
holder=''
# A duplicate refund must not update the already released reservation.
test "$(psql -X -At -v ON_ERROR_STOP=1 -c 'SELECT released FROM public.xoxo_refund_concurrency_fixture WHERE id=1')" = 't'
test "$(psql -X -At -v ON_ERROR_STOP=1 -c 'WITH retry AS (UPDATE public.xoxo_refund_concurrency_fixture SET released=true WHERE id=1 AND released=false RETURNING id) SELECT count(*) FROM retry')" = '0'
psql -X -v ON_ERROR_STOP=1 -c 'DROP TABLE public.xoxo_refund_concurrency_fixture'
echo 'Isolated concurrent lock and duplicate-refund fixture passed.'
