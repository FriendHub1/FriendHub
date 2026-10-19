-- XOXO Reveal BETA — durable multi-instance writer lease proposal.
-- REVIEW ONLY. DO NOT APPLY. Depends on writer_lifecycle_v2 draft.
BEGIN;
ALTER TABLE public.xoxo_reveal_upload_attempts
 ADD COLUMN IF NOT EXISTS writer_lease_expires_at timestamptz;
-- Only one active owner may renew the lease; token and sender must match.
CREATE OR REPLACE FUNCTION public.xoxo_reveal_renew_writer_lease_v3(
 p_attempt_id uuid,p_sender_id uuid,p_writer_token uuid,
 p_lease_seconds integer DEFAULT 90
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_row public.xoxo_reveal_upload_attempts%ROWTYPE;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN
  RAISE EXCEPTION 'Server authorization required';
 END IF;
 IF p_attempt_id IS NULL OR p_sender_id IS NULL OR p_writer_token IS NULL
  OR p_lease_seconds NOT BETWEEN 15 AND 120 THEN RETURN false; END IF;
 SELECT * INTO v_row FROM public.xoxo_reveal_upload_attempts a
  WHERE a.id=p_attempt_id AND a.sender_id=p_sender_id FOR UPDATE;
 IF NOT FOUND OR v_row.status<>'pending'
  OR v_row.writer_state<>'writing'
  OR v_row.claim_token IS DISTINCT FROM p_writer_token
  OR v_row.writer_lease_expires_at IS NULL
  OR v_row.writer_lease_expires_at<=clock_timestamp() THEN RETURN false; END IF;
 UPDATE public.xoxo_reveal_upload_attempts
  SET writer_lease_expires_at=clock_timestamp()+make_interval(secs=>p_lease_seconds),
  updated_at=clock_timestamp() WHERE id=p_attempt_id;
 RETURN true;
END;
$function$;
REVOKE ALL ON FUNCTION public.xoxo_reveal_renew_writer_lease_v3(uuid,uuid,uuid,integer)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.xoxo_reveal_renew_writer_lease_v3(uuid,uuid,uuid,integer)
 TO service_role;
COMMIT;
-- RELEASE BLOCKERS: writer_begin must atomically initialize lease expiry;
-- seal must require a live lease and ensure no in-flight writes; expired
-- leases must NOT permit reassignment until Storage operation completion is
-- known. Lease expiry alone cannot cancel an external Storage write.
