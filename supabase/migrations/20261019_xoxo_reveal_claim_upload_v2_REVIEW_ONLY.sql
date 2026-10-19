-- XOXO Reveal BETA — REVIEW ONLY. DO NOT APPLY TO PRODUCTION.
-- Supersedes xoxo_reveal_claim_upload_v1_REVIEW_ONLY.sql.
-- Depends on xoxo_reveal_idempotency_REVIEW_ONLY.sql.
BEGIN;
ALTER TABLE public.xoxo_reveal_upload_attempts
 ADD COLUMN IF NOT EXISTS claim_token uuid;
CREATE OR REPLACE FUNCTION public.xoxo_reveal_claim_upload_v2(
 p_sender_id uuid,p_request_key text,p_payload_fingerprint text
) RETURNS TABLE(action text,attempt_id uuid,owner_token uuid,reveal_id uuid,dm_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
 v_row public.xoxo_reveal_upload_attempts%ROWTYPE;
 v_inserted uuid;
 v_token uuid := gen_random_uuid();
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN
  RAISE EXCEPTION 'Server authorization required';
 END IF;
 IF p_sender_id IS NULL OR p_request_key IS NULL
  OR length(p_request_key) NOT BETWEEN 16 AND 128
  OR p_request_key !~ '^[A-Za-z0-9_-]+$'
  OR p_payload_fingerprint IS NULL
  OR p_payload_fingerprint !~ '^[0-9a-f]{64}$' THEN
  RAISE EXCEPTION 'Invalid idempotency request';
 END IF;
 INSERT INTO public.xoxo_reveal_upload_attempts
  (sender_id,request_key,payload_fingerprint,status,claim_token)
 VALUES(p_sender_id,p_request_key,p_payload_fingerprint,'pending',v_token)
 ON CONFLICT (sender_id,request_key) DO NOTHING
 RETURNING id INTO v_inserted;
 IF v_inserted IS NOT NULL THEN
  RETURN QUERY SELECT 'claimed'::text,v_inserted,v_token,NULL::uuid,NULL::uuid;
  RETURN;
 END IF;
 SELECT * INTO v_row FROM public.xoxo_reveal_upload_attempts a
 WHERE a.sender_id=p_sender_id AND a.request_key=p_request_key FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Unable to read upload attempt'; END IF;
 IF v_row.payload_fingerprint <> p_payload_fingerprint THEN
  RETURN QUERY SELECT 'reject'::text,v_row.id,NULL::uuid,NULL::uuid,NULL::uuid;
 ELSIF v_row.status='completed' AND v_row.reveal_id IS NOT NULL
   AND v_row.dm_id IS NOT NULL THEN
  RETURN QUERY SELECT 'return_existing'::text,v_row.id,NULL::uuid,v_row.reveal_id,v_row.dm_id;
 ELSIF v_row.status='pending' THEN
  RETURN QUERY SELECT 'wait'::text,v_row.id,NULL::uuid,NULL::uuid,NULL::uuid;
 ELSE
  RETURN QUERY SELECT 'manual_reconciliation'::text,v_row.id,NULL::uuid,NULL::uuid,NULL::uuid;
 END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.xoxo_reveal_claim_upload_v2(uuid,text,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.xoxo_reveal_claim_upload_v2(uuid,text,text)
 TO service_role;
COMMIT;
-- Claimed token must NEVER be returned to browser or logged.
-- Still NOT deployment ready: implement server-only finalize with fencing
-- token and atomic result commit; handle uncertain Storage/DB outcomes,
-- server-verified sender identity, retries and cleanup reconciliation.
-- This function alone cannot make Storage + DB writes atomic.
