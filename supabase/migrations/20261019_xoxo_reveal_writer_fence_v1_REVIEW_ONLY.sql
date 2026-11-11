-- XOXO Reveal BETA — durable writer token verification proposal.
-- REVIEW ONLY / NEVER APPLY TO PRODUCTION.
-- Depends on claim_upload_v2_REVIEW_ONLY.sql and its claim_token column.
-- This RPC validates an existing claim token under a row lock; it does NOT
-- prevent Storage writes already in flight and is NOT a complete fence.
BEGIN;
CREATE OR REPLACE FUNCTION public.xoxo_reveal_verify_writer_v1(
 p_attempt_id uuid,p_sender_id uuid,p_writer_token uuid
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
 v_attempt public.xoxo_reveal_upload_attempts%ROWTYPE;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN
  RAISE EXCEPTION 'Server authorization required';
 END IF;
 IF p_attempt_id IS NULL OR p_sender_id IS NULL OR p_writer_token IS NULL THEN
  RETURN false;
 END IF;
 SELECT * INTO v_attempt FROM public.xoxo_reveal_upload_attempts a
 WHERE a.id=p_attempt_id AND a.sender_id=p_sender_id FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 RETURN v_attempt.status='pending'
   AND v_attempt.claim_token IS NOT DISTINCT FROM p_writer_token;
END;
$function$;
REVOKE ALL ON FUNCTION public.xoxo_reveal_verify_writer_v1(uuid,uuid,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.xoxo_reveal_verify_writer_v1(uuid,uuid,uuid)
 TO service_role;
COMMIT;
-- RELEASE BLOCKER: verifying token at one instant cannot fence a concurrent
-- upload or Storage overwrite. A trusted server must prevent further writes,
-- wait for outstanding writes, and atomically revalidate in finalize SQL.
-- Token must never be sent to the browser or logged. Not deployment ready.
