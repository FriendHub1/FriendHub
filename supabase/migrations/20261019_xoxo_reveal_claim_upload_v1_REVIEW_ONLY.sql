-- XOXO Reveal BETA — REVIEW ONLY. DO NOT APPLY TO PRODUCTION.
-- Server-only transactional claim for upload idempotency.
-- Depends on 20261019_xoxo_reveal_idempotency_REVIEW_ONLY.sql.
BEGIN;
CREATE OR REPLACE FUNCTION public.xoxo_reveal_claim_upload_v1(
 p_sender_id uuid,p_request_key text,p_payload_fingerprint text
) RETURNS TABLE(action text,attempt_id uuid,reveal_id uuid,dm_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
 v_role text := current_setting('request.jwt.claim.role',true);
 v_row public.xoxo_reveal_upload_attempts%ROWTYPE;
BEGIN
 -- Must be called only by trusted service-role backend. The backend must
 -- derive p_sender_id from a verified JWT; never trust browser-provided IDs.
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
 -- Unique index on (sender_id,request_key) arbitrates concurrent inserts.
 INSERT INTO public.xoxo_reveal_upload_attempts
  (sender_id,request_key,payload_fingerprint,status)
 VALUES(p_sender_id,p_request_key,p_payload_fingerprint,'pending')
 ON CONFLICT (sender_id,request_key) DO NOTHING;
 SELECT * INTO v_row
 FROM public.xoxo_reveal_upload_attempts a
 WHERE a.sender_id=p_sender_id AND a.request_key=p_request_key
 FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Unable to claim upload'; END IF;
 IF v_row.payload_fingerprint <> p_payload_fingerprint THEN
  RETURN QUERY SELECT 'reject'::text,v_row.id,NULL::uuid,NULL::uuid;
 ELSIF v_row.status='completed'
   AND v_row.reveal_id IS NOT NULL AND v_row.dm_id IS NOT NULL THEN
  RETURN QUERY SELECT 'return_existing'::text,v_row.id,v_row.reveal_id,v_row.dm_id;
 ELSIF v_row.status='pending' THEN
  RETURN QUERY SELECT 'pending'::text,v_row.id,NULL::uuid,NULL::uuid;
 ELSE
  RETURN QUERY SELECT 'manual_reconciliation'::text,v_row.id,NULL::uuid,NULL::uuid;
 END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.xoxo_reveal_claim_upload_v1(uuid,text,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.xoxo_reveal_claim_upload_v1(uuid,text,text)
 TO service_role;
COMMIT;
-- IMPORTANT DESIGN LIMITATION:
-- Both the first caller and subsequent callers see 'pending'; the function
-- does not return a unique owner/claim token. It is NOT sufficient to authorize
-- upload execution. Before use, add an atomic owner/fencing-token mechanism
-- and a server-only finalize/reconciliation transaction.
-- Row locks are held only during the RPC transaction, NOT during Storage upload.
-- Validate effective role with actual Supabase service-role execution context.
-- Never deploy until the owner/fencing and ambiguous-failure paths are reviewed.
