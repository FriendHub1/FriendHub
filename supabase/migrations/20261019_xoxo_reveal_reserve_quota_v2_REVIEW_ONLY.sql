-- XOXO Reveal BETA — attempt-bound quota reservation v2.
-- REVIEW ONLY; DO NOT APPLY TO PRODUCTION.
-- Depends on quota_isolated_v2, idempotency, reconciliation_links, claim v2.
-- Trusted server passes a previously claimed attempt ID and its owner token.
BEGIN;
CREATE OR REPLACE FUNCTION public.xoxo_reveal_reserve_quota_v2(
 p_attempt_id uuid,p_sender_id uuid,p_claim_token uuid,p_bytes bigint
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
 v_attempt public.xoxo_reveal_upload_attempts%ROWTYPE;
 v_existing public.xoxo_reveal_quota_reservations%ROWTYPE;
 v_hour_count bigint;
 v_day_count bigint;
 v_hour_bytes bigint;
 v_now timestamptz := clock_timestamp();
 v_id uuid;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN
  RAISE EXCEPTION 'Server authorization required';
 END IF;
 IF p_attempt_id IS NULL OR p_sender_id IS NULL OR p_claim_token IS NULL
 OR p_bytes IS NULL OR p_bytes < 1 OR p_bytes > 15728640 THEN
  RAISE EXCEPTION 'Invalid quota request';
 END IF;
 -- Fixed lock order: sender quota advisory lock, then attempt row.
 PERFORM pg_advisory_xact_lock(hashtextextended(p_sender_id::text,761921));
 SELECT * INTO v_attempt FROM public.xoxo_reveal_upload_attempts a
 WHERE a.id=p_attempt_id AND a.sender_id=p_sender_id FOR UPDATE;
 IF NOT FOUND OR v_attempt.status <> 'pending'
 OR v_attempt.claim_token IS DISTINCT FROM p_claim_token THEN
  RAISE EXCEPTION 'Invalid attempt ownership or state';
 END IF;
 SELECT * INTO v_existing FROM public.xoxo_reveal_quota_reservations q
 WHERE q.upload_attempt_id=p_attempt_id FOR UPDATE;
 IF FOUND THEN
  IF v_existing.sender_id <> p_sender_id
  OR v_existing.byte_count <> p_bytes
  OR v_existing.released_at IS NOT NULL THEN
   RAISE EXCEPTION 'Conflicting quota reservation';
  END IF;
  RETURN v_existing.id;
 END IF;
 SELECT count(*),coalesce(sum(byte_count),0)
 INTO v_hour_count,v_hour_bytes
 FROM public.xoxo_reveal_quota_reservations
 WHERE sender_id=p_sender_id AND released_at IS NULL
 AND created_at >= v_now - interval '1 hour';
 SELECT count(*) INTO v_day_count
 FROM public.xoxo_reveal_quota_reservations
 WHERE sender_id=p_sender_id AND released_at IS NULL
 AND created_at >= v_now - interval '1 day';
 IF v_hour_count >= 120 OR v_day_count >= 600
 OR v_hour_bytes + p_bytes > 1200::bigint * 1024 * 1024 THEN
  RAISE EXCEPTION 'Reveal quota exceeded';
 END IF;
 INSERT INTO public.xoxo_reveal_quota_reservations
 (sender_id,byte_count,upload_attempt_id)
 VALUES(p_sender_id,p_bytes,p_attempt_id)
 RETURNING id INTO v_id;
 RETURN v_id;
END;
$function$;
REVOKE ALL ON FUNCTION public.xoxo_reveal_reserve_quota_v2(uuid,uuid,uuid,bigint)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.xoxo_reveal_reserve_quota_v2(uuid,uuid,uuid,bigint)
 TO service_role;
COMMIT;
-- BLOCKERS: server must derive sender from verified JWT; bind quota bytes to
-- trusted validated payload and fingerprint; verify actual Storage byte count.
-- Old reserve_quota_v1 must not be used for new uploads after v2 integration.
-- Refund/reconciliation must validate exact attempt and uncertain outcomes.
-- Requires isolated PostgreSQL and concurrency testing before any deployment.
