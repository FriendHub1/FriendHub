#!/usr/bin/env bash
# XOXO Reveal BETA: two real PostgreSQL sessions, disposable CI database only.
set -euo pipefail
test "${PGHOST:-}" = "127.0.0.1"
test "${PGDATABASE:-}" = "xoxo_reveal_test_ci"
test "${PGUSER:-}" = "xoxo_test"
workdir="$(mktemp -d)"
export XOXO_WRITER_LOCK_MARKER="$workdir/locked"
holder=''
cleanup() {
 if [[ -n "$holder" ]]; then kill "$holder" 2>/dev/null || true; wait "$holder" 2>/dev/null || true; fi
 rm -rf "$workdir"
}
trap cleanup EXIT
psql -X -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO public.xoxo_reveal_upload_attempts(id,sender_id,status,claim_token)
VALUES ('00000000-0000-0000-0000-000000004001',
        '00000000-0000-0000-0000-000000004002','pending',
        '00000000-0000-0000-0000-000000004003');
SQL
psql -X -v ON_ERROR_STOP=1 >"$workdir/holder.log" 2>&1 <<'SQL' &
BEGIN;
SET LOCAL request.jwt.claim.role='service_role';
SELECT id FROM public.xoxo_reveal_upload_attempts
WHERE id='00000000-0000-0000-0000-000000004001' FOR UPDATE;
\! touch "$XOXO_WRITER_LOCK_MARKER"
SELECT pg_sleep(3);
COMMIT;
SQL
holder=$!
ready=0
for i in {1..100}; do
 if [[ -f "$XOXO_WRITER_LOCK_MARKER" ]]; then ready=1; break; fi
 if ! kill -0 "$holder" 2>/dev/null; then break; fi
 sleep 0.05
done
if [[ "$ready" != 1 ]]; then cat "$workdir/holder.log" >&2; exit 1; fi
# The real draft row-lock function must fail fast against a held row.
result="$(psql -X -At -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
SET LOCAL request.jwt.claim.role='service_role';
SELECT public.xoxo_reveal_try_lock_attempt_v1(
 '00000000-0000-0000-0000-000000004001',
 '00000000-0000-0000-0000-000000004002');
COMMIT;
SQL
)"
if [[ "$(printf '%s\n' "$result" | grep -c '^f$')" != 1 ]]; then
 echo "Second session did not receive false from NOWAIT lock" >&2
 echo "$result" >&2
 exit 1
fi
wait "$holder"
holder=''
# After holder commits, claim succeeds and a distinct writer is rejected.
result="$(psql -X -At -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
SET LOCAL request.jwt.claim.role='service_role';
SELECT public.xoxo_reveal_claim_writer_v1(
 '00000000-0000-0000-0000-000000004001',
 '00000000-0000-0000-0000-000000004002',
 '00000000-0000-0000-0000-000000004003',
 '00000000-0000-0000-0000-000000004004',60);
COMMIT;
BEGIN;
SET LOCAL request.jwt.claim.role='service_role';
SELECT public.xoxo_reveal_claim_writer_v1(
 '00000000-0000-0000-0000-000000004001',
 '00000000-0000-0000-0000-000000004002',
 '00000000-0000-0000-0000-000000004003',
 '00000000-0000-0000-0000-000000004005',60);
COMMIT;
SQL
)"
if ! grep -qx 'claimed' <<< "$result" || ! grep -qx 'busy' <<< "$result"; then
 echo "Writer ownership checks failed: $result" >&2
 exit 1
fi
psql -X -v ON_ERROR_STOP=1 -c "DELETE FROM public.xoxo_reveal_upload_attempts WHERE id='00000000-0000-0000-0000-000000004001'"
echo 'Isolated two-session writer lock and ownership tests passed.'
