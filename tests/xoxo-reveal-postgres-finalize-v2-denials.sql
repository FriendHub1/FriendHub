-- Actual finalize v2 denial matrix, disposable CI PostgreSQL only.
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
INSERT INTO public.direct_messages(id,sender_id,recipient_id)
VALUES ('33333333-3333-4333-8333-333333333333',
'44444444-4444-4444-8444-444444444444','66666666-6666-4666-8666-666666666666');
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
 scenario text;
BEGIN
 FOR scenario IN SELECT unnest(ARRAY['wrong_claim','unsealed','uncertain','wrong_dm','released_quota','wrong_object','wrong_sender','non_service']) LOOP
  IF scenario='unsealed' THEN UPDATE public.xoxo_reveal_upload_attempts SET writer_state='writing'; END IF;
  IF scenario='uncertain' THEN UPDATE public.xoxo_reveal_upload_attempts SET upload_uncertain_at=clock_timestamp(); END IF;
  IF scenario='released_quota' THEN UPDATE public.xoxo_reveal_quota_reservations SET released_at=clock_timestamp(); END IF;
  IF scenario='wrong_object' THEN UPDATE public.xoxo_reveal_upload_objects SET object_path='private/wrong.webp'; END IF;
  IF scenario='wrong_sender' THEN UPDATE public.xoxo_reveals SET sender_id='77777777-7777-4777-8777-777777777777'; END IF;
  IF scenario='non_service' THEN PERFORM set_config('request.jwt.claim.role','authenticated',true); END IF;
  BEGIN
   PERFORM public.xoxo_reveal_finalize_upload_v2(
    attempt,sender,CASE WHEN scenario='wrong_claim' THEN '88888888-8888-4888-8888-888888888888'::uuid ELSE token END,
    reveal,CASE WHEN scenario='wrong_dm' THEN '99999999-9999-4999-8999-999999999999'::uuid ELSE dm END);
   RAISE EXCEPTION 'Unexpected finalize success: %',scenario;
  EXCEPTION WHEN OTHERS THEN
   IF SQLERRM LIKE 'Unexpected finalize success:%' THEN RAISE; END IF;
  END;
  PERFORM set_config('request.jwt.claim.role','service_role',true);
  UPDATE public.xoxo_reveal_upload_attempts SET writer_state='sealed',upload_uncertain_at=NULL;
  UPDATE public.xoxo_reveal_quota_reservations SET released_at=NULL;
  UPDATE public.xoxo_reveal_upload_objects SET object_path='private/photo.webp';
  UPDATE public.xoxo_reveals SET sender_id=sender;
  IF (SELECT status FROM public.xoxo_reveal_upload_attempts WHERE id=attempt)<>'pending'
  THEN RAISE EXCEPTION 'Denied scenario changed status: %',scenario; END IF;
 END LOOP;
END $test$;
ROLLBACK;
