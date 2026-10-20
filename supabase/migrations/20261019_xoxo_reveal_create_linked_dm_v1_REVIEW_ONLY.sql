-- XOXO Reveal BETA — REVIEW ONLY. NEVER APPLY TO LIVE SUPABASE.
-- Single PostgreSQL transaction: reject missing sealed attempt, invalid DM
-- relationship, blocks or absent private object reservation before any insert.
-- The upload attempt must have been authenticated and fenced separately.
-- SCHEMA GATE: this draft expects the full xoxo_reveals beta schema plus
-- upload_attempt_id and payload_fingerprint (not in the base beta migration).
-- DO NOT DEPLOY until schema and block-insert serialization are reviewed.
-- Recipient binding requires a separately reviewed change to the upload-claim
-- flow; legacy attempts without a recipient are intentionally rejected.
CREATE OR REPLACE FUNCTION public.xoxo_reveal_create_linked_dm_v1(
 p_attempt_id uuid,p_claim_token uuid,p_sender_id uuid,p_recipient_id uuid,p_object_path text,
 p_media_type text,p_mode text,p_duration_seconds integer DEFAULT NULL
) RETURNS TABLE(reveal_id uuid,dm_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE v_attempt public.xoxo_reveal_upload_attempts%ROWTYPE;
        v_dm_id uuid;v_reveal_id uuid;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN
  RAISE EXCEPTION 'Server authorization required';
 END IF;
 IF p_attempt_id IS NULL OR p_claim_token IS NULL OR p_sender_id IS NULL OR p_recipient_id IS NULL OR p_sender_id=p_recipient_id
  OR p_object_path IS NULL OR length(p_object_path)<1
  OR p_object_path LIKE '/%' OR p_object_path LIKE '%..%'
  OR p_object_path LIKE '%\\%' OR p_object_path LIKE '%?%'
  OR p_object_path LIKE '%#%'
  OR p_media_type NOT IN ('image','video')
  OR p_mode NOT IN ('once','timed','keep')
  OR (p_mode='timed' AND (p_duration_seconds IS NULL OR p_duration_seconds NOT IN (5,10,15,20)))
  OR (p_mode<>'timed' AND p_duration_seconds IS NOT NULL)
 THEN RAISE EXCEPTION 'Invalid Reveal metadata'; END IF;
 -- Serialize linked sends for the exact sender/recipient pair across requests.
 -- This alone does NOT serialize independent user_blocks INSERT operations.
 PERFORM pg_advisory_xact_lock(hashtextextended(
  LEAST(p_sender_id::text,p_recipient_id::text)||':'||
  GREATEST(p_sender_id::text,p_recipient_id::text), 0));
 -- Lock the durable attempt, not an untrusted browser-supplied object record.
 SELECT * INTO v_attempt FROM public.xoxo_reveal_upload_attempts a
 WHERE a.id=p_attempt_id AND a.claim_token=p_claim_token
  AND a.sender_id=p_sender_id AND a.recipient_id=p_recipient_id
  AND a.status='pending'
  AND a.writer_state='sealed' AND a.upload_uncertain_at IS NULL
  AND EXISTS(SELECT 1 FROM public.xoxo_reveal_upload_objects o
   WHERE o.attempt_id=a.id AND o.sender_id=a.sender_id
    AND o.bucket_id='xoxo-reveal' AND o.object_path=p_object_path
    AND o.payload_fingerprint=a.payload_fingerprint)
  AND NOT EXISTS(SELECT 1 FROM public.xoxo_reveals existing
   WHERE existing.upload_attempt_id=a.id)
  AND EXISTS(SELECT 1 FROM public.xoxo_reveal_quota_reservations q
   WHERE q.upload_attempt_id=a.id AND q.sender_id=a.sender_id
    AND q.released_at IS NULL)
 FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'No sealed and reserved upload attempt'; END IF;
 IF EXISTS(SELECT 1 FROM public.user_blocks b WHERE
   (b.blocker_id=p_sender_id AND b.blocked_id=p_recipient_id) OR
   (b.blocker_id=p_recipient_id AND b.blocked_id=p_sender_id))
 THEN RAISE EXCEPTION 'DM relationship blocked'; END IF;
 IF NOT public.xoxo_has_existing_dm_or_acceptance(p_sender_id,p_recipient_id)
 THEN RAISE EXCEPTION 'DM relationship not authorized'; END IF;
 /* Existing DM relationship audit retained below for isolated test parity.
 IF NOT EXISTS(SELECT 1 FROM public.direct_messages d WHERE
    (d.sender_id=p_sender_id AND d.recipient_id=p_recipient_id) OR
    (d.sender_id=p_recipient_id AND d.recipient_id=p_sender_id))
  AND NOT EXISTS(SELECT 1 FROM public.message_requests m
    WHERE m.status='accepted' AND
    ((m.sender_id=p_sender_id AND m.recipient_id=p_recipient_id) OR
     (m.sender_id=p_recipient_id AND m.recipient_id=p_sender_id)))
 THEN RAISE EXCEPTION 'DM relationship not authorized'; END IF; */
 INSERT INTO public.direct_messages(id,sender_id,recipient_id)
 VALUES(gen_random_uuid(),p_sender_id,p_recipient_id) RETURNING id INTO v_dm_id;
 INSERT INTO public.xoxo_reveals(
  id,dm_id,upload_attempt_id,sender_id,recipient_id,
  object_path,payload_fingerprint,media_type,mode,duration_seconds
 ) VALUES(gen_random_uuid(),v_dm_id,v_attempt.id,p_sender_id,p_recipient_id,
  p_object_path,v_attempt.payload_fingerprint,p_media_type,p_mode,p_duration_seconds)
 RETURNING id INTO v_reveal_id;
 RETURN QUERY SELECT v_reveal_id,v_dm_id;
END $fn$;
REVOKE ALL ON FUNCTION public.xoxo_reveal_create_linked_dm_v1(uuid,uuid,uuid,uuid,text,text,text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.xoxo_reveal_create_linked_dm_v1(uuid,uuid,uuid,uuid,text,text,text,integer) TO service_role;
-- RELEASE BLOCKERS: populate immutable recipient_id at trusted claim time,
-- durable object identity, exact DM INSERT columns, and serialization with
-- concurrent user_blocks inserts are NOT yet guaranteed by this draft.
