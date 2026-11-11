-- XOXO Reveal BETA — durable upload uncertainty marker.
-- REVIEW ONLY / DO NOT APPLY. Requires upload_attempts base migration.
BEGIN;
ALTER TABLE public.xoxo_reveal_upload_attempts
 ADD COLUMN IF NOT EXISTS upload_uncertain_at timestamptz,
 ADD COLUMN IF NOT EXISTS upload_uncertain_reason text;
CREATE OR REPLACE FUNCTION public.xoxo_reveal_mark_upload_uncertain_v1(
 p_attempt_id uuid,p_sender_id uuid,p_reason text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_row public.xoxo_reveal_upload_attempts%ROWTYPE;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN
  RAISE EXCEPTION 'Server authorization required';
 END IF;
 IF p_attempt_id IS NULL OR p_sender_id IS NULL
  OR p_reason IS NULL OR length(p_reason) NOT BETWEEN 1 AND 80
  OR p_reason !~ '^[a-z_]+$' THEN RETURN false; END IF;
 SELECT * INTO v_row FROM public.xoxo_reveal_upload_attempts a
 WHERE a.id=p_attempt_id AND a.sender_id=p_sender_id FOR UPDATE;
 IF NOT FOUND OR v_row.status='completed' THEN RETURN false; END IF;
 UPDATE public.xoxo_reveal_upload_attempts
 SET upload_uncertain_at=COALESCE(upload_uncertain_at,clock_timestamp()),
 upload_uncertain_reason=COALESCE(upload_uncertain_reason,p_reason),
 updated_at=clock_timestamp()
 WHERE id=p_attempt_id;
 RETURN true;
END;
$function$;
REVOKE ALL ON FUNCTION public.xoxo_reveal_mark_upload_uncertain_v1(uuid,uuid,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.xoxo_reveal_mark_upload_uncertain_v1(uuid,uuid,text)
 TO service_role;
COMMIT;
-- RELEASE BLOCKER: every writer begin, renew, seal and finalize RPC must
-- atomically reject upload_uncertain_at IS NOT NULL under its row lock.
-- A failed uncertainty-marker RPC must fail closed, not permit retries.
-- Reconciliation requires separate privileged proof that Storage settled.
