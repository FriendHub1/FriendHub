-- Disposable PostgreSQL only; after refund-v2 stub setup.
DO $guard$
BEGIN
 IF current_database()<>'xoxo_reveal_test_ci' OR current_user<>'xoxo_test'
 THEN RAISE EXCEPTION 'Wrong isolated target'; END IF;
END $guard$;
BEGIN;
SET LOCAL request.jwt.claim.role='service_role';
INSERT INTO public.xoxo_reveal_upload_attempts(id,sender_id,status)
VALUES ('00000000-0000-0000-0000-000000002001',
        '00000000-0000-0000-0000-000000002002','pending');
DO $tests$
BEGIN
 IF public.xoxo_reveal_try_lock_attempt_v1(
 '00000000-0000-0000-0000-000000002001',
 '00000000-0000-0000-0000-000000002002') IS DISTINCT FROM true
 THEN RAISE EXCEPTION 'Expected lock'; END IF;
 IF public.xoxo_reveal_try_lock_attempt_v1(
 '00000000-0000-0000-0000-000000002001',
 '00000000-0000-0000-0000-000000002003') IS DISTINCT FROM false
 THEN RAISE EXCEPTION 'Wrong sender acquired lock'; END IF;
 IF public.xoxo_reveal_try_lock_attempt_v1(
 '00000000-0000-0000-0000-000000002004',
 '00000000-0000-0000-0000-000000002002') IS DISTINCT FROM false
 THEN RAISE EXCEPTION 'Unknown attempt acquired lock'; END IF;
END $tests$;
ROLLBACK;
BEGIN;
SET LOCAL request.jwt.claim.role='authenticated';
DO $tests$
BEGIN
 BEGIN
  PERFORM public.xoxo_reveal_try_lock_attempt_v1(
   '00000000-0000-0000-0000-000000002001',
   '00000000-0000-0000-0000-000000002002');
  RAISE EXCEPTION 'Unexpected authorization';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM <> 'Unauthorized' THEN RAISE; END IF;
 END;
END $tests$;
ROLLBACK;
