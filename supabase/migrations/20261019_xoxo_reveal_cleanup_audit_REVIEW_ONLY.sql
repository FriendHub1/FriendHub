-- XOXO Reveal BETA — REVIEW ONLY. DO NOT APPLY TO PRODUCTION.
-- Private, append-only cleanup audit events. No media, paths, email or tokens.
BEGIN;
CREATE TABLE IF NOT EXISTS public.xoxo_reveal_cleanup_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  reveal_id uuid NOT NULL,
  operation_id text NOT NULL CHECK (
    length(operation_id) BETWEEN 8 AND 100 AND operation_id ~ '^[A-Za-z0-9_-]+$'
  ),
  event_type text NOT NULL DEFAULT 'xoxo_reveal_cleanup'
    CHECK (event_type = 'xoxo_reveal_cleanup'),
  action text NOT NULL CHECK (action IN (
    'candidate_reviewed','cleanup_deferred','cleanup_eligible',
    'cleanup_failed','cleanup_completed'
  )),
  reason text NOT NULL CHECK (reason IN (
    'expired_and_unheld','retention_hold','keep_mode',
    'session_active_or_unknown','not_expired_with_grace',
    'no_valid_expiry','missing_record','storage_error',
    'db_error','manual_review'
  )),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version = 1)
);
CREATE INDEX IF NOT EXISTS xoxo_reveal_cleanup_audit_reveal_time_idx
  ON public.xoxo_reveal_cleanup_audit(reveal_id,occurred_at DESC);
CREATE INDEX IF NOT EXISTS xoxo_reveal_cleanup_audit_operation_idx
  ON public.xoxo_reveal_cleanup_audit(operation_id);
ALTER TABLE public.xoxo_reveal_cleanup_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.xoxo_reveal_cleanup_audit FROM PUBLIC, anon, authenticated;
-- No RLS client policies. Writes must come from trusted server code only.
-- Append-only enforcement: forbid UPDATE/DELETE even for privileged API roles.
CREATE OR REPLACE FUNCTION public.xoxo_reveal_audit_immutable_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'Cleanup audit events are immutable';
END;
$$;
DROP TRIGGER IF EXISTS xoxo_reveal_audit_immutable ON public.xoxo_reveal_cleanup_audit;
CREATE TRIGGER xoxo_reveal_audit_immutable
BEFORE UPDATE OR DELETE ON public.xoxo_reveal_cleanup_audit
FOR EACH ROW EXECUTE FUNCTION public.xoxo_reveal_audit_immutable_v1();
COMMIT;
-- SECURITY REVIEW REQUIRED:
-- * Verify table owner, service-role insert privileges, RLS and function ownership.
-- * Use a server-only insert interface and schema validation; never expose a
--   service-role key or audit INSERT permission to clients.
-- * Define a bounded retention policy (proposal: 90 days), legal holds,
--   and a separate privileged maintenance process for approved purges.
-- * Trigger intentionally blocks ordinary deletes, including retention cleanup;
--   retention purge must be designed and audited before deployment.
-- * No FK to xoxo_reveals so evidence survives Reveal record cleanup.
-- * Never apply this file without explicit production authorization.
