-- XOXO Reveal BETA — REVIEW ONLY, DO NOT APPLY TO PRODUCTION.
-- Requires the idempotency schema, claim-upload v2, and Reveal schema.
-- Server-only, fenced completion: a stale or wrong token cannot finalize.
BEGIN;
CREATE OR REPLACE FUNCTION public.xoxo_reveal_finalize_upload_v1(
 p_attempt_id uuid,
 p_sender_id uuid,
 p_claim_token uuid,
 p_reveal_id uuid,
 p_dm_id uuid
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
 v_attempt public.xoxo_reveal_upload_attempts%ROWTYPE;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN
   RAISE EXCEPTION 'Server authorization required';
 END IF;
 IF p_attempt_id IS NULL OR p_sender_id IS NULL OR p_claim_token IS NULL
    OR p_reveal_id IS NULL OR p_dm_id IS NULL THEN
   RAISE EXCEPTION 'Missing finalize arguments';
 END IF;
 SELECT * INTO v_attempt
 FROM public.xoxo_reveal_upload_attempts a
 WHERE a.id = p_attempt_id AND a.sender_id = p_sender_id
 FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Attempt not found'; END IF;
 -- Do not expose token or let an old worker overwrite a newer result.
 IF v_attempt.claim_token IS DISTINCT FROM p_claim_token THEN
   RAISE EXCEPTION 'Invalid claim ownership';
 END IF;
 IF v_attempt.status = 'completed' THEN
   IF v_attempt.reveal_id = p_reveal_id AND v_attempt.dm_id = p_dm_id THEN
     RETURN 'already_completed';
   END IF;
   RAISE EXCEPTION 'Conflicting completed attempt';
 END IF;
 IF v_attempt.status <> 'pending' THEN
   RAISE EXCEPTION 'Attempt requires reconciliation';
 END IF;
 -- A matching, linked Reveal + DM must already exist. Prevent fabricated IDs.
 IF NOT EXISTS (
   SELECT 1 FROM public.xoxo_reveals r
   JOIN public.direct_messages d ON d.id = r.dm_id
   WHERE r.id = p_reveal_id AND r.dm_id = p_dm_id
     AND r.sender_id = p_sender_id AND d.sender_id = p_sender_id
     AND r.recipient_id = d.recipient_id
 ) THEN
   RAISE EXCEPTION 'Linked Reveal/DM not found';
 END IF;
 UPDATE public.xoxo_reveal_upload_attempts
 SET status='completed',reveal_id=p_reveal_id,dm_id=p_dm_id,
     updated_at=now()
 WHERE id=p_attempt_id;
 RETURN 'completed';
END;
$$;
REVOKE ALL ON FUNCTION public.xoxo_reveal_finalize_upload_v1(uuid,uuid,uuid,uuid,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.xoxo_reveal_finalize_upload_v1(uuid,uuid,uuid,uuid,uuid)
 TO service_role;
COMMIT;
-- CRITICAL: Review only. This does not make Storage upload and DB linking
-- atomic. It does not implement transaction-safe message creation, retries,
-- orphan cleanup, reconciliation, or quota refunds.
-- Sender identity MUST be derived by a trusted backend from a verified JWT.
-- The owner token MUST stay on the server and never appear in logs/browser.
-- Before production: bind attempts to the exact payload fingerprint and
-- linked reveal, add an explicit upload lease/recovery protocol, validate
-- roles in deployed Supabase, and review data retention/abuse handling.
