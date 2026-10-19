-- XOXO Reveal BETA — stricter finalize v2, REVIEW ONLY, DO NOT APPLY.
-- Requires beta, idempotency, quota_isolated_v2, reconciliation_links,
-- claim_upload_v2 drafts in a disposable Supabase-compatible test database.
-- Replaces finalize v1 for future isolated integration testing only.
BEGIN;
CREATE OR REPLACE FUNCTION public.xoxo_reveal_finalize_upload_v2(
 p_attempt_id uuid,p_sender_id uuid,p_claim_token uuid,
 p_reveal_id uuid,p_dm_id uuid
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $function$
DECLARE
 v_attempt public.xoxo_reveal_upload_attempts%ROWTYPE;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN
  RAISE EXCEPTION 'Server authorization required';
 END IF;
 IF p_attempt_id IS NULL OR p_sender_id IS NULL OR p_claim_token IS NULL
 OR p_reveal_id IS NULL OR p_dm_id IS NULL THEN
  RAISE EXCEPTION 'Missing finalize arguments';
 END IF;
 SELECT * INTO v_attempt
 FROM public.xoxo_reveal_upload_attempts a
 WHERE a.id=p_attempt_id AND a.sender_id=p_sender_id
 FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Attempt not found'; END IF;
 IF v_attempt.claim_token IS DISTINCT FROM p_claim_token THEN
  RAISE EXCEPTION 'Invalid claim ownership';
 END IF;
 IF v_attempt.status='completed' THEN
  IF v_attempt.reveal_id=p_reveal_id AND v_attempt.dm_id=p_dm_id THEN
   RETURN 'already_completed';
  END IF;
  RAISE EXCEPTION 'Conflicting completed attempt';
 END IF;
 IF v_attempt.status <> 'pending' THEN
  RAISE EXCEPTION 'Attempt requires reconciliation';
 END IF;
 -- The upload coordinator must seal the writer after all Storage writes
 -- complete; finalization rejects active or never-started writers.
 IF v_attempt.upload_uncertain_at IS NOT NULL THEN
  RAISE EXCEPTION 'Upload outcome requires reconciliation';
 END IF;
 IF v_attempt.writer_state IS DISTINCT FROM 'sealed' THEN
  RAISE EXCEPTION 'Reveal writer is not sealed';
 END IF;
 -- Bind the reveal and DM to the locked attempt BEFORE using their
 -- identities for permission checks. Never authorize an unrelated reveal.
 IF NOT EXISTS (
  SELECT 1 FROM public.xoxo_reveals r
  JOIN public.direct_messages d ON d.id=r.dm_id
  WHERE r.id=p_reveal_id AND r.dm_id=p_dm_id
    AND r.upload_attempt_id=v_attempt.id
    AND r.sender_id=v_attempt.sender_id
    AND d.sender_id=v_attempt.sender_id
    AND d.recipient_id=r.recipient_id
    AND r.sender_id <> r.recipient_id
 ) THEN
  RAISE EXCEPTION 'Reveal/DM identity binding mismatch';
 END IF;
 -- Recheck current DM permissions inside the finalize transaction.
 -- These relationship reads do not lock a future block INSERT; a stronger
 -- serialized delivery gate is still required before production.
 IF EXISTS (
  SELECT 1 FROM public.user_blocks b
  JOIN public.xoxo_reveals r ON r.id=p_reveal_id
  WHERE (b.blocker_id=r.sender_id AND b.blocked_id=r.recipient_id)
     OR (b.blocker_id=r.recipient_id AND b.blocked_id=r.sender_id)
 ) THEN
  RAISE EXCEPTION 'Current DM relationship is blocked';
 END IF;
 IF NOT EXISTS (
  SELECT 1 FROM public.xoxo_reveals r
  WHERE r.id=p_reveal_id AND (
   EXISTS (SELECT 1 FROM public.direct_messages d
    WHERE (d.sender_id=r.sender_id AND d.recipient_id=r.recipient_id)
       OR (d.sender_id=r.recipient_id AND d.recipient_id=r.sender_id))
   OR EXISTS (SELECT 1 FROM public.message_requests mr
    WHERE mr.status='accepted' AND
      ((mr.sender_id=r.sender_id AND mr.recipient_id=r.recipient_id)
       OR (mr.sender_id=r.recipient_id AND mr.recipient_id=r.sender_id)))
  )
 ) THEN
  RAISE EXCEPTION 'Current DM relationship is not authorized';
 END IF;
 -- Exact attempt, fingerprint, sender, object path, and recipient binding.
 IF NOT EXISTS (
  SELECT 1
  FROM public.xoxo_reveals r
  JOIN public.direct_messages d ON d.id=r.dm_id
  JOIN public.xoxo_reveal_upload_objects o
    ON o.attempt_id=v_attempt.id
  JOIN public.xoxo_reveal_quota_reservations q
    ON q.upload_attempt_id=v_attempt.id
  WHERE r.id=p_reveal_id AND r.dm_id=p_dm_id
    AND r.upload_attempt_id=v_attempt.id
    AND r.sender_id=v_attempt.sender_id
    AND d.sender_id=v_attempt.sender_id
    AND r.recipient_id=d.recipient_id
    AND r.sender_id <> r.recipient_id
    AND r.payload_fingerprint=v_attempt.payload_fingerprint
    AND o.sender_id=v_attempt.sender_id
    AND o.payload_fingerprint=v_attempt.payload_fingerprint
    AND o.bucket_id='xoxo-reveal'
    AND o.object_path=r.object_path
    AND q.sender_id=v_attempt.sender_id
    AND q.released_at IS NULL
 ) THEN
  RAISE EXCEPTION 'Reveal/DM/object/quota binding mismatch';
 END IF;
 UPDATE public.xoxo_reveal_upload_attempts
 SET status='completed',reveal_id=p_reveal_id,dm_id=p_dm_id,
 updated_at=clock_timestamp()
 WHERE id=v_attempt.id;
 RETURN 'completed';
END;
$function$;
REVOKE ALL ON FUNCTION public.xoxo_reveal_finalize_upload_v2(uuid,uuid,uuid,uuid,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.xoxo_reveal_finalize_upload_v2(uuid,uuid,uuid,uuid,uuid)
 TO service_role;
COMMIT;
-- IMPORTANT: SQL association is not proof that Storage bytes exist or match.
-- Trusted server must verify actual Storage metadata/digest before finalize.
-- Depends on writer_lifecycle_v2_REVIEW_ONLY.sql; SQL sealed state alone
-- does not fence a concurrent external Storage overwrite.
-- Quota reservation must be created atomically for this attempt; existing
-- reserve_quota_v1 does not bind an attempt and needs a revised RPC.
-- Storage and DB cannot commit atomically. Reconciliation still required.
-- No production execution is authorized.
