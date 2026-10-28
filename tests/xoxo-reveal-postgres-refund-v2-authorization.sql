-- Disposable PostgreSQL authorization and cross-sender refund checks.
DO $guard$
BEGIN
 IF current_database()<>'xoxo_reveal_test_ci' OR current_user<>'xoxo_test'
 THEN RAISE EXCEPTION 'Wrong isolated target'; END IF;
END $guard$;
BEGIN;
INSERT INTO public.xoxo_reveal_upload_attempts(id,sender_id,status)
VALUES ('00000000-0000-0000-0000-000000000501',
        '00000000-0000-0000-0000-000000000601','failed');
INSERT INTO public.xoxo_reveal_quota_reservations(id,sender_id,upload_attempt_id)
VALUES ('00000000-0000-0000-0000-000000000701',
        '00000000-0000-0000-0000-000000000601',
        '00000000-0000-0000-0000-000000000501');
SET LOCAL request.jwt.claim.role='authenticated';
DO $tests$
BEGIN
 BEGIN
  PERFORM public.xoxo_reveal_release_quota_v2(
   '00000000-0000-0000-0000-000000000501',
   '00000000-0000-0000-0000-000000000601',
   '00000000-0000-0000-0000-000000000701');
  RAISE EXCEPTION 'Unauthorized refund unexpectedly succeeded';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM <> 'Server authorization required' THEN RAISE; END IF;
 END;
END $tests$;
SET LOCAL request.jwt.claim.role='service_role';
DO $tests$
BEGIN
 BEGIN
  PERFORM public.xoxo_reveal_release_quota_v2(
   '00000000-0000-0000-0000-000000000501',
   '00000000-0000-0000-0000-000000000602',
   '00000000-0000-0000-0000-000000000701');
  RAISE EXCEPTION 'Cross-sender refund unexpectedly succeeded';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM <> 'Attempt not found' THEN RAISE; END IF;
 END;
 IF EXISTS (SELECT 1 FROM public.xoxo_reveal_quota_reservations
   WHERE id='00000000-0000-0000-0000-000000000701'
   AND released_at IS NOT NULL) THEN
  RAISE EXCEPTION 'Denied refund mutated reservation';
 END IF;
END $tests$;
ROLLBACK;
