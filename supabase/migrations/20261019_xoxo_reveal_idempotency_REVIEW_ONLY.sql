-- XOXO Reveal BETA — REVIEW ONLY, DO NOT APPLY TO PRODUCTION.
-- Persistent sender-scoped idempotency state; no public direct table access.
BEGIN;
CREATE TABLE IF NOT EXISTS public.xoxo_reveal_upload_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users(id),
  request_key text NOT NULL CHECK (
    length(request_key) BETWEEN 16 AND 128
    AND request_key ~ '^[A-Za-z0-9_-]+$'
  ),
  payload_fingerprint text NOT NULL CHECK (
    payload_fingerprint ~ '^[0-9a-f]{64}$'
  ),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','completed','failed','needs_reconciliation')),
  reveal_id uuid,
  dm_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  lease_expires_at timestamptz,
  UNIQUE(sender_id,request_key),
  CHECK (
    status <> 'completed' OR (reveal_id IS NOT NULL AND dm_id IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS xoxo_reveal_upload_attempts_status_idx
 ON public.xoxo_reveal_upload_attempts(status,updated_at);
ALTER TABLE public.xoxo_reveal_upload_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.xoxo_reveal_upload_attempts FROM PUBLIC,anon,authenticated;
-- No browser-facing RLS policies or GRANTs. Only trusted server code may
-- atomically claim/update attempts and retrieve completed results.
COMMIT;
-- CRITICAL RELEASE BLOCKERS:
-- * Build a SECURITY DEFINER/server-only transactional claim/finalize API
--   with verified auth, advisory/row locks and lease fencing tokens.
-- * Never trust sender_id or payload fingerprint from the browser. Hash a
--   canonical server-validated payload INCLUDING bytes and recipient/mode.
-- * On retry, reject fingerprint mismatch. Completed attempts must return
--   the existing result; pending attempts must NOT start another upload.
-- * Expired lease does not prove failure: reconcile Storage, DM and quota
--   before allowing any retry after an uncertain remote commit.
-- * Atomicity across Storage and PostgreSQL is not automatic; implement
--   orphan cleanup, quota refund and incident audit.
-- * Bound retention and ensure referenced records are not prematurely removed.
-- * Do not apply without explicit production authorization.
