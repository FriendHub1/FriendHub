-- XOXO Reveal BETA — attempt-bound quota release v2, REVIEW ONLY.
-- DO NOT APPLY TO PRODUCTION. Requires idempotency + quota + link drafts.
BEGIN;
CREATE OR REPLACE FUNCTION public.xoxo_reveal_release_quota_v2(
 p_attempt_id uuid,p_sender_id uuid,p_reservation_id uuid
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
 v_attempt public.xoxo_reveal_upload_attempts%ROWTYPE;
 v_quota public.xoxo_reveal_quota_reservations%ROWTYPE;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN
  RAISE EXCEPTION 'Server authorization required';
 END IF;
 IF p_attempt_id IS NULL OR p_sender_id IS NULL OR p_reservation_id IS NULL THEN
  RAISE EXCEPTION 'Missing refund arguments';
 END IF;
 -- Same lock order as reserve_quota_v2: sender lock, then attempt row.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_sender_id::text,761921));
 SELECT * INTO v_attempt FROM public.xoxo_reveal_upload_attempts a
 WHERE a.id=p_attempt_id AND a.sender_id=p_sender_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Attempt not found'; END IF;
 -- Unknown/pending/completed outcomes are not safe to refund.
 IF v_attempt.status='completed' THEN
  RAISE EXCEPTION 'Completed upload cannot be refunded';
 END IF;
 IF v_attempt.status <> 'failed' THEN
  RAISE EXCEPTION 'Refund requires verified failed attempt';
 END IF;
 -- Fail closed when any Reveal is linked to this attempt, even if status
 -- was mistakenly set to failed; this avoids refunding a delivered gift.
 IF EXISTS (
  SELECT 1 FROM public.xoxo_reveals r
  WHERE r.upload_attempt_id=p_attempt_id
 ) THEN
  RAISE EXCEPTION 'Linked Reveal requires reconciliation';
 END IF;
 SELECT * INTO v_quota FROM public.xoxo_reveal_quota_reservations q
 WHERE q.id=p_reservation_id AND q.upload_attempt_id=p_attempt_id
 AND q.sender_id=p_sender_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Reservation not found'; END IF;
 IF v_quota.released_at IS NOT NULL THEN
  RETURN 'already_released';
 END IF;
 UPDATE public.xoxo_reveal_quota_reservations
 SET released_at=clock_timestamp()
 WHERE id=v_quota.id AND released_at IS NULL;
 RETURN 'released';
END;
$function$;
REVOKE ALL ON FUNCTION public.xoxo_reveal_release_quota_v2(uuid,uuid,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.xoxo_reveal_release_quota_v2(uuid,uuid,uuid)
 TO service_role;
COMMIT;
-- CRITICAL: status='failed' alone is not authoritative proof that no
-- Storage object or DM message exists. Before any production use, the
-- trusted reconciler MUST verify authoritative Storage + DM evidence and
-- bind that proof to the failed state in an atomic/fenced operation.
-- This draft alone is NOT safe to deploy or call for real refunds.
