-- XOXO Reveal BETA — REVIEW ONLY. NEVER APPLY TO PRODUCTION.
-- Durable writer lease proposal, backed by the existing attempt row.
-- Does not fence Supabase Storage uploads on its own.
ALTER TABLE public.xoxo_reveal_upload_attempts
 ADD COLUMN IF NOT EXISTS writer_token uuid,
 ADD COLUMN IF NOT EXISTS writer_generation bigint NOT NULL DEFAULT 0,
 ADD COLUMN IF NOT EXISTS writer_lease_expires_at timestamptz,
 ADD COLUMN IF NOT EXISTS writer_state text NOT NULL DEFAULT 'idle'
 CHECK (writer_state IN ('idle','writing','needs_reconciliation'));
CREATE OR REPLACE FUNCTION public.xoxo_reveal_claim_writer_v1(
 p_attempt_id uuid,p_sender_id uuid,p_claim_token uuid,p_writer_token uuid,
 p_lease_seconds integer DEFAULT 60
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_attempt public.xoxo_reveal_upload_attempts%ROWTYPE;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN
  RAISE EXCEPTION 'Unauthorized';
 END IF;
 IF p_attempt_id IS NULL OR p_sender_id IS NULL OR p_claim_token IS NULL
    OR p_writer_token IS NULL OR p_lease_seconds IS NULL
    OR p_lease_seconds NOT BETWEEN 10 AND 120 THEN
  RAISE EXCEPTION 'Invalid writer claim';
 END IF;
 SELECT * INTO v_attempt FROM public.xoxo_reveal_upload_attempts
 WHERE id=p_attempt_id AND sender_id=p_sender_id FOR UPDATE;
 IF NOT FOUND THEN RETURN 'not_found'; END IF;
 IF v_attempt.status IS DISTINCT FROM 'pending' OR
    v_attempt.claim_token IS DISTINCT FROM p_claim_token THEN
  RETURN 'not_owner';
 END IF;
 IF v_attempt.writer_state='needs_reconciliation' THEN
  RETURN 'manual_reconciliation';
 END IF;
 IF v_attempt.writer_state='writing' THEN
  IF v_attempt.writer_token=p_writer_token AND
     v_attempt.writer_lease_expires_at>clock_timestamp() THEN
   RETURN 'already_owned';
  END IF;
  -- Expired lease does NOT prove Storage has stopped writing.
  IF v_attempt.writer_lease_expires_at<=clock_timestamp() OR
     v_attempt.writer_lease_expires_at IS NULL THEN
   UPDATE public.xoxo_reveal_upload_attempts
   SET writer_state='needs_reconciliation'
   WHERE id=p_attempt_id;
   RETURN 'manual_reconciliation';
  END IF;
  RETURN 'busy';
 END IF;
 UPDATE public.xoxo_reveal_upload_attempts
 SET writer_state='writing',writer_token=p_writer_token,
     writer_generation=writer_generation+1,
     writer_lease_expires_at=clock_timestamp()+make_interval(secs=>p_lease_seconds)
 WHERE id=p_attempt_id;
 RETURN 'claimed';
END $function$;
REVOKE ALL ON FUNCTION public.xoxo_reveal_claim_writer_v1(uuid,uuid,uuid,uuid,integer)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.xoxo_reveal_claim_writer_v1(uuid,uuid,uuid,uuid,integer)
 TO service_role;
-- An expired lease must be reconciled, NEVER stolen automatically.
-- A real Storage writer must verify generation/token at every safe boundary.
