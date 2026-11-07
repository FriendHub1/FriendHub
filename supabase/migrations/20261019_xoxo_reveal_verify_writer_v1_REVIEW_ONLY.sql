-- XOXO Reveal BETA — REVIEW ONLY. Never apply to production.
-- Depends on writer_lease_v1 draft. Read-only check, not a Storage fence.
CREATE OR REPLACE FUNCTION public.xoxo_reveal_verify_writer_v1(
 p_attempt_id uuid,p_sender_id uuid,p_writer_token uuid
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_valid boolean;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN
  RAISE EXCEPTION 'Unauthorized';
 END IF;
 IF p_attempt_id IS NULL OR p_sender_id IS NULL OR p_writer_token IS NULL
 THEN RETURN false; END IF;
 SELECT EXISTS(
  SELECT 1 FROM public.xoxo_reveal_upload_attempts
  WHERE id=p_attempt_id AND sender_id=p_sender_id
   AND status='pending' AND writer_state='writing'
   AND writer_token=p_writer_token
   AND writer_lease_expires_at>clock_timestamp()
 ) INTO v_valid;
 RETURN v_valid;
END $function$;
REVOKE ALL ON FUNCTION public.xoxo_reveal_verify_writer_v1(uuid,uuid,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.xoxo_reveal_verify_writer_v1(uuid,uuid,uuid)
 TO service_role;
-- A successful read can become stale immediately. It cannot stop an
-- already-started Storage operation or authorize refunds/finalization.
