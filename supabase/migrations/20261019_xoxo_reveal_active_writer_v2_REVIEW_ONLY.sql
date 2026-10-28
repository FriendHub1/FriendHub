-- XOXO Reveal BETA — active writer RPC. REVIEW ONLY / NOT DEPLOYED.
-- Requires writer_lifecycle_v2_REVIEW_ONLY.sql.
BEGIN;
CREATE OR REPLACE FUNCTION public.xoxo_reveal_verify_active_writer_v2(
 p_attempt_id uuid,p_sender_id uuid,p_writer_token uuid
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_row public.xoxo_reveal_upload_attempts%ROWTYPE;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN
  RAISE EXCEPTION 'Server authorization required';
 END IF;
 IF p_attempt_id IS NULL OR p_sender_id IS NULL OR p_writer_token IS NULL
 THEN RETURN false; END IF;
 SELECT * INTO v_row FROM public.xoxo_reveal_upload_attempts a
  WHERE a.id=p_attempt_id AND a.sender_id=p_sender_id FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 RETURN v_row.status='pending' AND v_row.upload_uncertain_at IS NULL
  AND v_row.writer_state='writing'
  AND v_row.claim_token IS NOT DISTINCT FROM p_writer_token;
END;
$function$;
REVOKE ALL ON FUNCTION public.xoxo_reveal_verify_active_writer_v2(uuid,uuid,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.xoxo_reveal_verify_active_writer_v2(uuid,uuid,uuid)
 TO service_role;
COMMIT;
-- A preflight RPC check cannot prevent a concurrent seal during Storage upload.
-- RELEASE BLOCKER: exclusive server writer coordinator must track in-flight
-- operations and prevent sealing until all writes have settled. Signed upload
-- tokens and alternate privileged Storage write routes must be disabled.
