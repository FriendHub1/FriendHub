-- XOXO Reveal BETA — REVIEW ONLY. NEVER APPLY TO PRODUCTION.
-- Depends on:
-- 20261019_xoxo_reveal_beta_REVIEW_ONLY.sql
-- 20261019_xoxo_reveal_quota_REVIEW_ONLY.sql
-- 20261019_xoxo_reveal_idempotency_REVIEW_ONLY.sql
-- This is a schema PROPOSAL for trusted reconciliation, not an executable
-- production migration plan. Audit dependencies and existing rows first.
BEGIN;
-- Bind every private Reveal record to the originating attempt and payload.
ALTER TABLE public.xoxo_reveals
  ADD COLUMN IF NOT EXISTS upload_attempt_id uuid,
  ADD COLUMN IF NOT EXISTS payload_fingerprint text;
ALTER TABLE public.xoxo_reveals
  ADD CONSTRAINT xoxo_reveals_payload_fingerprint_format
  CHECK (payload_fingerprint IS NULL OR payload_fingerprint ~ '^[0-9a-f]{64}$');
ALTER TABLE public.xoxo_reveals
  ADD CONSTRAINT xoxo_reveals_upload_attempt_fk
  FOREIGN KEY (upload_attempt_id)
  REFERENCES public.xoxo_reveal_upload_attempts(id)
  ON DELETE RESTRICT;
CREATE UNIQUE INDEX IF NOT EXISTS xoxo_reveals_upload_attempt_unique
 ON public.xoxo_reveals(upload_attempt_id)
 WHERE upload_attempt_id IS NOT NULL;
-- Associate a quota reservation with exactly one upload attempt.
ALTER TABLE public.xoxo_reveal_quota_reservations
  ADD COLUMN IF NOT EXISTS upload_attempt_id uuid;
ALTER TABLE public.xoxo_reveal_quota_reservations
  ADD CONSTRAINT xoxo_reveal_quota_upload_attempt_fk
  FOREIGN KEY (upload_attempt_id)
  REFERENCES public.xoxo_reveal_upload_attempts(id)
  ON DELETE RESTRICT;
CREATE UNIQUE INDEX IF NOT EXISTS xoxo_reveal_quota_attempt_unique
 ON public.xoxo_reveal_quota_reservations(upload_attempt_id)
 WHERE upload_attempt_id IS NOT NULL;
-- Immutable private-object locator is needed for authoritative Storage reads.
-- Do not trust client-provided paths. This association is populated only by
-- trusted server code after verifying the object belongs to the attempt.
CREATE TABLE IF NOT EXISTS public.xoxo_reveal_upload_objects (
  attempt_id uuid PRIMARY KEY REFERENCES public.xoxo_reveal_upload_attempts(id)
    ON DELETE RESTRICT,
  sender_id uuid NOT NULL REFERENCES auth.users(id),
  bucket_id text NOT NULL DEFAULT 'xoxo-reveal'
    CHECK (bucket_id='xoxo-reveal'),
  object_path text NOT NULL UNIQUE CHECK (length(object_path) BETWEEN 1 AND 1024),
  payload_fingerprint text NOT NULL CHECK (payload_fingerprint ~ '^[0-9a-f]{64} timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.xoxo_reveal_upload_objects ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.xoxo_reveal_upload_objects FROM PUBLIC,anon,authenticated;
COMMIT;
-- CRITICAL RELEASE BLOCKERS:
-- 1. These nullable columns are for review/backfill. Enforce NOT NULL only
--    for newly created linked records via reviewed server-side transactions.
-- 2. Cross-table sender/fingerprint equality is NOT enforced by these FKs.
--    Add transactional verification and appropriate composite constraints.
-- 3. expected_sha256 must be computed by trusted server code from actual
--    private object bytes and protected from mutation by browser roles.
--    Storage objects are outside PostgreSQL transactions. Verify object
--    metadata/digest with trusted Storage reads and reconcile inconsistencies.
-- 4. The earlier quota migration has an invalid dollar-quote terminator
--    around xoxo_reveal_release_quota_v1; fix before any isolated SQL testing.
-- 5. Repeated ALTER ADD CONSTRAINT is not rerunnable as written.
-- 6. Validate permissions, existing data, indexes, function signatures,
--    privacy, retention, cost and rollback in an isolated Supabase project.
-- 7. No production deployment or schema modification is authorized.
),
  -- Server-computed digest of actual object bytes, not payload fingerprint.
  expected_sha256 text NOT NULL CHECK (expected_sha256 ~ '^[0-9a-f]{64} timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.xoxo_reveal_upload_objects ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.xoxo_reveal_upload_objects FROM PUBLIC,anon,authenticated;
COMMIT;
-- CRITICAL RELEASE BLOCKERS:
-- 1. These nullable columns are for review/backfill. Enforce NOT NULL only
--    for newly created linked records via reviewed server-side transactions.
-- 2. Cross-table sender/fingerprint equality is NOT enforced by these FKs.
--    Add transactional verification and appropriate composite constraints.
-- 3. Storage objects are outside PostgreSQL transactions. Verify object
--    metadata/digest with trusted Storage reads and reconcile inconsistencies.
-- 4. The earlier quota migration has an invalid dollar-quote terminator
--    around xoxo_reveal_release_quota_v1; fix before any isolated SQL testing.
-- 5. Repeated ALTER ADD CONSTRAINT is not rerunnable as written.
-- 6. Validate permissions, existing data, indexes, function signatures,
--    privacy, retention, cost and rollback in an isolated Supabase project.
-- 7. No production deployment or schema modification is authorized.
),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.xoxo_reveal_upload_objects ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.xoxo_reveal_upload_objects FROM PUBLIC,anon,authenticated;
COMMIT;
-- CRITICAL RELEASE BLOCKERS:
-- 1. These nullable columns are for review/backfill. Enforce NOT NULL only
--    for newly created linked records via reviewed server-side transactions.
-- 2. Cross-table sender/fingerprint equality is NOT enforced by these FKs.
--    Add transactional verification and appropriate composite constraints.
-- 3. Storage objects are outside PostgreSQL transactions. Verify object
--    metadata/digest with trusted Storage reads and reconcile inconsistencies.
-- 4. The earlier quota migration has an invalid dollar-quote terminator
--    around xoxo_reveal_release_quota_v1; fix before any isolated SQL testing.
-- 5. Repeated ALTER ADD CONSTRAINT is not rerunnable as written.
-- 6. Validate permissions, existing data, indexes, function signatures,
--    privacy, retention, cost and rollback in an isolated Supabase project.
-- 7. No production deployment or schema modification is authorized.
