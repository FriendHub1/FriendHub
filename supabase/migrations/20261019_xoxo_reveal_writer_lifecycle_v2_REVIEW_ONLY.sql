-- XOXO Reveal BETA — durable writer lifecycle proposal.
-- REVIEW ONLY / NOT DEPLOYED. Requires claim_upload_v2 and a trusted
-- server-only upload coordinator. This is not an executable release plan.
BEGIN;
ALTER TABLE public.xoxo_reveal_upload_attempts
 ADD COLUMN IF NOT EXISTS writer_state text NOT NULL DEFAULT 'idle'
 CHECK (writer_state IN ('idle','writing','sealed'));
-- Writer start is serialized on the attempt row. Only the current owner may
-- start a write; sealed attempts cannot be reopened.
CREATE OR REPLACE FUNCTION public.xoxo_reveal_writer_begin_v2(
 p_attempt_id uuid,p_sender_id uuid,p_writer_token uuid
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_row public.xoxo_reveal_upload_attempts%ROWTYPE;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN
  RAISE EXCEPTION 'Server authorization required';
 END IF;
 IF p_attempt_id IS NULL OR p_sender_id IS NULL OR p_writer_token IS NULL THEN
  RETURN false;
 END IF;
 SELECT * INTO v_row FROM public.xoxo_reveal_upload_attempts a
  WHERE a.id=p_attempt_id AND a.sender_id=p_sender_id FOR UPDATE;
 IF NOT FOUND OR v_row.status<>'pending'
  OR v_row.claim_token IS DISTINCT FROM p_writer_token
  OR v_row.writer_state<>'idle' THEN RETURN false; END IF;
 UPDATE public.xoxo_reveal_upload_attempts SET writer_state='writing',
  updated_at=clock_timestamp() WHERE id=p_attempt_id;
 RETURN true;
END;
$function$;
-- A trusted coordinator may seal only after Storage upload completion and
-- verification of actual bytes. This RPC alone does not verify Storage.
CREATE OR REPLACE FUNCTION public.xoxo_reveal_writer_seal_v2(
 p_attempt_id uuid,p_sender_id uuid,p_writer_token uuid
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_row public.xoxo_reveal_upload_attempts%ROWTYPE;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN
  RAISE EXCEPTION 'Server authorization required';
 END IF;
 IF p_attempt_id IS NULL OR p_sender_id IS NULL OR p_writer_token IS NULL THEN
  RETURN false;
 END IF;
 SELECT * INTO v_row FROM public.xoxo_reveal_upload_attempts a
  WHERE a.id=p_attempt_id AND a.sender_id=p_sender_id FOR UPDATE;
 IF NOT FOUND OR v_row.status<>'pending'
  OR v_row.claim_token IS DISTINCT FROM p_writer_token
  OR v_row.writer_state<>'writing' THEN RETURN false; END IF;
 UPDATE public.xoxo_reveal_upload_attempts SET writer_state='sealed',
  updated_at=clock_timestamp() WHERE id=p_attempt_id;
 RETURN true;
END;
$function$;
REVOKE ALL ON FUNCTION public.xoxo_reveal_writer_begin_v2(uuid,uuid,uuid)
 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.xoxo_reveal_writer_seal_v2(uuid,uuid,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.xoxo_reveal_writer_begin_v2(uuid,uuid,uuid)
 TO service_role;
GRANT EXECUTE ON FUNCTION public.xoxo_reveal_writer_seal_v2(uuid,uuid,uuid)
 TO service_role;
COMMIT;
-- RELEASE BLOCKERS: must make Storage upload coordinator the exclusive writer,
-- prevent signed-token reuse and direct Storage overwrite, verify completed
-- uploads before seal, reconcile abandoned writing states, and recheck sealed
-- state atomically in finalize RPC. SQL alone cannot fence external Storage.
