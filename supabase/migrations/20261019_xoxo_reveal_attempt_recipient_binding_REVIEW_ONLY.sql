-- XOXO Reveal BETA — REVIEW ONLY / DO NOT APPLY.
-- Schema prerequisite for atomic linked-DM v1.
-- Existing attempts remain NULL and cannot be delivered by linked-DM v1.
-- Trusted claim flow must bind recipient at initial INSERT before rollout.
BEGIN;
ALTER TABLE public.xoxo_reveal_upload_attempts
 ADD COLUMN IF NOT EXISTS recipient_id uuid;
ALTER TABLE public.xoxo_reveal_upload_attempts
 ADD CONSTRAINT xoxo_reveal_attempt_distinct_recipient
 CHECK (recipient_id IS NULL OR recipient_id <> sender_id);
COMMIT;
-- This migration alone is not sufficient: claim_upload_v2 does not yet
-- populate recipient_id. No live migration is authorized.
