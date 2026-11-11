-- Behavioral checks for actual finalize v2 on disposable PostgreSQL only.
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
DO $test$ DECLARE result text; BEGIN
 SELECT public.xoxo_reveal_finalize_upload_v2(
 '11111111-1111-4111-8111-111111111111','44444444-4444-4444-8444-444444444444',
 '55555555-5555-4555-8555-555555555555','22222222-2222-4222-8222-222222222222',
 '33333333-3333-4333-8333-333333333333') INTO result;
 IF result<>'completed' THEN RAISE EXCEPTION 'Expected completed, got %',result; END IF;
 SELECT public.xoxo_reveal_finalize_upload_v2(
 '11111111-1111-4111-8111-111111111111','44444444-4444-4444-8444-444444444444',
 '55555555-5555-4555-8555-555555555555','22222222-2222-4222-8222-222222222222',
 '33333333-3333-4333-8333-333333333333') INTO result;
 IF result<>'already_completed' THEN RAISE EXCEPTION 'Idempotency failed: %',result; END IF;
 -- Completed replay must not succeed after object or quota binding changes.
 UPDATE public.xoxo_reveal_upload_objects SET object_path='private/changed.webp';
 BEGIN
  PERFORM public.xoxo_reveal_finalize_upload_v2(
   '11111111-1111-4111-8111-111111111111','44444444-4444-4444-8444-444444444444',
   '55555555-5555-4555-8555-555555555555','22222222-2222-4222-8222-222222222222',
   '33333333-3333-4333-8333-333333333333');
  RAISE EXCEPTION 'Unexpected replay success after object reassignment';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM='Unexpected replay success after object reassignment' THEN RAISE; END IF;
  IF SQLERRM NOT LIKE '%binding mismatch%' THEN RAISE EXCEPTION 'Wrong denial: %',SQLERRM; END IF;
 END;
 UPDATE public.xoxo_reveal_upload_objects SET object_path='private/photo.webp';
 UPDATE public.xoxo_reveal_quota_reservations SET released_at=clock_timestamp();
 BEGIN
  PERFORM public.xoxo_reveal_finalize_upload_v2(
   '11111111-1111-4111-8111-111111111111','44444444-4444-4444-8444-444444444444',
   '55555555-5555-4555-8555-555555555555','22222222-2222-4222-8222-222222222222',
   '33333333-3333-4333-8333-333333333333');
  RAISE EXCEPTION 'Unexpected replay success after quota release';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM='Unexpected replay success after quota release' THEN RAISE; END IF;
  IF SQLERRM NOT LIKE '%binding mismatch%' THEN RAISE EXCEPTION 'Wrong denial: %',SQLERRM; END IF;
 END;
 UPDATE public.xoxo_reveal_quota_reservations SET released_at=NULL;
 -- A completed attempt cannot be acknowledged if its DM was reassigned.
 UPDATE public.direct_messages
 SET recipient_id='77777777-7777-4777-8777-777777777777'
 WHERE id='33333333-3333-4333-8333-333333333333';
 BEGIN
  PERFORM public.xoxo_reveal_finalize_upload_v2(
   '11111111-1111-4111-8111-111111111111','44444444-4444-4444-8444-444444444444',
   '55555555-5555-4555-8555-555555555555','22222222-2222-4222-8222-222222222222',
   '33333333-3333-4333-8333-333333333333');
  RAISE EXCEPTION 'Unexpected replay success after DM reassignment';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM='Unexpected replay success after DM reassignment' THEN RAISE; END IF;
  IF SQLERRM NOT LIKE '%binding mismatch%' THEN RAISE EXCEPTION 'Wrong denial: %',SQLERRM; END IF;
 END;
 UPDATE public.direct_messages
 SET recipient_id='66666666-6666-4666-8666-666666666666'
 WHERE id='33333333-3333-4333-8333-333333333333';
 INSERT INTO public.user_blocks(blocker_id,blocked_id)
 VALUES ('66666666-6666-4666-8666-666666666666',
         '44444444-4444-4444-8444-444444444444');
 BEGIN
  PERFORM public.xoxo_reveal_finalize_upload_v2(
   '11111111-1111-4111-8111-111111111111','44444444-4444-4444-8444-444444444444',
   '55555555-5555-4555-8555-555555555555','22222222-2222-4222-8222-222222222222',
   '33333333-3333-4333-8333-333333333333');
  RAISE EXCEPTION 'Unexpected idempotent success after block';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM='Unexpected idempotent success after block' THEN RAISE; END IF;
  IF SQLERRM NOT LIKE '%blocked%' THEN RAISE EXCEPTION 'Unexpected denial: %',SQLERRM; END IF;
 END;
 IF (SELECT status FROM public.xoxo_reveal_upload_attempts LIMIT 1)<>'completed'
 THEN RAISE EXCEPTION 'Block unexpectedly changed completed record'; END IF;
END $test$;
ROLLBACK;
-- Blocked relationships must fail closed without marking attempt completed.
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
INSERT INTO public.user_blocks(blocker_id,blocked_id)
VALUES ('66666666-6666-4666-8666-666666666666','44444444-4444-4444-8444-444444444444');
DO $test$ BEGIN
 BEGIN
  PERFORM public.xoxo_reveal_finalize_upload_v2(
  '11111111-1111-4111-8111-111111111111','44444444-4444-4444-8444-444444444444',
  '55555555-5555-4555-8555-555555555555','22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333');
  RAISE EXCEPTION 'Unexpected success for blocked DM';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM='Unexpected success for blocked DM' THEN RAISE; END IF;
  IF SQLERRM NOT LIKE '%blocked%' THEN RAISE EXCEPTION 'Unexpected denial: %',SQLERRM; END IF;
 END;
 IF (SELECT status FROM public.xoxo_reveal_upload_attempts LIMIT 1)<>'pending'
 THEN RAISE EXCEPTION 'Blocked DM changed attempt state'; END IF;
END $test$;
ROLLBACK;
