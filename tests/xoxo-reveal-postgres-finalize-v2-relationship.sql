-- Isolated PostgreSQL: relationship authorization and both block directions.
DO $guard$ BEGIN
 IF current_database()<>'xoxo_reveal_finalize_ci' OR current_user<>'xoxo_test'
 THEN RAISE EXCEPTION 'Refusing non-test database'; END IF;
END $guard$;
BEGIN;
SELECT set_config('request.jwt.claim.role','service_role',true);
INSERT INTO public.xoxo_reveal_upload_attempts
(id,sender_id,claim_token,status,writer_state,payload_fingerprint)
VALUES ('11111111-1111-4111-8111-111111111111','44444444-4444-4444-8444-444444444444',
'55555555-5555-4555-8555-555555555555','pending','sealed',repeat('f',64));
INSERT INTO public.xoxo_reveals
(id,dm_id,upload_attempt_id,sender_id,recipient_id,object_path,payload_fingerprint)
VALUES ('22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333',
'11111111-1111-4111-8111-111111111111','44444444-4444-4444-8444-444444444444',
'66666666-6666-4666-8666-666666666666','private/photo.webp',repeat('f',64));
INSERT INTO public.xoxo_reveal_upload_objects
(attempt_id,sender_id,payload_fingerprint,bucket_id,object_path)
VALUES ('11111111-1111-4111-8111-111111111111',
'44444444-4444-4444-8444-444444444444',repeat('f',64),'xoxo-reveal','private/photo.webp');
INSERT INTO public.xoxo_reveal_quota_reservations(upload_attempt_id,sender_id)
VALUES ('11111111-1111-4111-8111-111111111111','44444444-4444-4444-8444-444444444444');
DO $test$
DECLARE
 attempt constant uuid:='11111111-1111-4111-8111-111111111111';
 sender constant uuid:='44444444-4444-4444-8444-444444444444';
 token constant uuid:='55555555-5555-4555-8555-555555555555';
 reveal constant uuid:='22222222-2222-4222-8222-222222222222';
 dm constant uuid:='33333333-3333-4333-8333-333333333333';
 recipient constant uuid:='66666666-6666-4666-8666-666666666666';
 result text;
BEGIN
 -- An accepted request alone does not replace the required linked DM row.
 INSERT INTO public.message_requests(sender_id,recipient_id,status)
 VALUES(sender,recipient,'accepted');
 BEGIN
  PERFORM public.xoxo_reveal_finalize_upload_v2(attempt,sender,token,reveal,dm);
  RAISE EXCEPTION 'Unexpected success without bound DM';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM='Unexpected success without bound DM' THEN RAISE; END IF;
  IF SQLERRM NOT LIKE '%identity binding mismatch%' THEN
   RAISE EXCEPTION 'Expected missing DM binding, got: %',SQLERRM;
  END IF;
 END;
 INSERT INTO public.direct_messages(id,sender_id,recipient_id)
 VALUES(dm,sender,recipient);
 -- Accepted request authorizes a newly bound DM, even if no prior DM history.
 SELECT public.xoxo_reveal_finalize_upload_v2(attempt,sender,token,reveal,dm) INTO result;
 IF result<>'completed' THEN RAISE EXCEPTION 'Accepted request failed: %',result; END IF;
 UPDATE public.xoxo_reveal_upload_attempts SET status='pending',reveal_id=NULL,dm_id=NULL;
 DELETE FROM public.message_requests;
 -- Bound DM itself now provides the existing-DM authorization.
 SELECT public.xoxo_reveal_finalize_upload_v2(attempt,sender,token,reveal,dm) INTO result;
 IF result<>'completed' THEN RAISE EXCEPTION 'Existing DM failed: %',result; END IF;
 UPDATE public.xoxo_reveal_upload_attempts SET status='pending',reveal_id=NULL,dm_id=NULL;
 FOR result IN SELECT unnest(ARRAY['sender_blocks','recipient_blocks']) LOOP
  IF result='sender_blocks' THEN
   INSERT INTO public.user_blocks(blocker_id,blocked_id) VALUES(sender,recipient);
  ELSE
   INSERT INTO public.user_blocks(blocker_id,blocked_id) VALUES(recipient,sender);
  END IF;
  BEGIN
   PERFORM public.xoxo_reveal_finalize_upload_v2(attempt,sender,token,reveal,dm);
   RAISE EXCEPTION 'Unexpected blocked finalize: %',result;
  EXCEPTION WHEN OTHERS THEN
   IF SQLERRM LIKE 'Unexpected blocked finalize:%' THEN RAISE; END IF;
   IF SQLERRM NOT LIKE '%blocked%' THEN RAISE EXCEPTION 'Wrong block denial: %',SQLERRM; END IF;
  END;
  DELETE FROM public.user_blocks;
  IF (SELECT status FROM public.xoxo_reveal_upload_attempts WHERE id=attempt)<>'pending'
  THEN RAISE EXCEPTION 'Blocked finalize mutated attempt'; END IF;
 END LOOP;
END $test$;
ROLLBACK;
