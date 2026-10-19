-- XOXO Reveal BETA — lease-aware writer lifecycle.
-- REVIEW ONLY / NOT DEPLOYED. Depends on writer_lifecycle_v2 and
-- writer_lease_v3 drafts. Replaces begin_v2 and seal_v2 only in isolated tests.
BEGIN;
CREATE OR REPLACE FUNCTION public.xoxo_reveal_writer_begin_v3(
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
  OR v_row.writer_state<>'idle'
  OR v_row.claim_token IS DISTINCT FROM p_writer_token THEN RETURN false; END IF;
 UPDATE public.xoxo_reveal_upload_attempts
 SET writer_state='writing',
  writer_lease_expires_at=clock_timestamp()+make_interval(secs=>p_lease_seconds),
  updated_at=clock_timestamp() WHERE id=p_attempt_id;
 RETURN true;
END;
$function$;
CREATE OR REPLACE FUNCTION public.xoxo_reveal_writer_seal_v3(
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
 IF NOT FOUND OR v_row.status<>'pending'
  OR v_row.writer_state<>'writing'
  OR v_row.claim_token IS DISTINCT FROM p_writer_token
  OR v_row.writer_lease_expires_at IS NULL
  OR v_row.writer_lease_expires_at<=clock_timestamp() THEN RETURN false; END IF;
 UPDATE public.xoxo_reveal_upload_attempts
 SET writer_state='sealed',writer_lease_expires_at=NULL,
  updated_at=clock_timestamp() WHERE id=p_attempt_id;
 RETURN true;
END;
$function$;
REVOKE ALL ON FUNCTION public.xoxo_reveal_writer_begin_v3(uuid,uuid,uuid,integer)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.xoxo_reveal_writer_seal_v3(uuid,uuid,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.xoxo_reveal_writer_begin_v3(uuid,uuid,uuid,integer)
 TO service_role;
GRANT EXECUTE ON FUNCTION public.xoxo_reveal_writer_seal_v3(uuid,uuid,uuid)
 TO service_role;
COMMIT;
-- CRITICAL: a lease expiring while an upload is in flight must NOT allow
-- reassignment or sealing by another process. External Storage operations
-- cannot be rolled back with the SQL transaction. Exclusive writer routing,
-- completion tracking and reconciliation remain release blockers.
