-- XOXO Reveal BETA: real refund v2 SQL must roll back on caller failure.
-- Disposable PostgreSQL only, after setup and migration.
DO $guard$
BEGIN
 IF current_database()<>'xoxo_reveal_test_ci' OR current_user<>'xoxo_test'
 THEN RAISE EXCEPTION 'Wrong isolated target'; END IF;
END $guard$;
BEGIN;
SET LOCAL request.jwt.claim.role='service_role';
INSERT INTO public.xoxo_reveal_upload_attempts(id,sender_id,status)
VALUES ('00000000-0000-0000-0000-000000001001',
        '00000000-0000-0000-0000-000000001002','failed');
INSERT INTO public.xoxo_reveal_quota_reservations(id,sender_id,upload_attempt_id)
VALUES ('00000000-0000-0000-0000-000000001003',
        '00000000-0000-0000-0000-000000001002',
        '00000000-0000-0000-0000-000000001001');
DO $tests$
DECLARE result text;
BEGIN
 BEGIN
  SELECT public.xoxo_reveal_release_quota_v2(
   '00000000-0000-0000-0000-000000001001',
   '00000000-0000-0000-0000-000000001002',
   '00000000-0000-0000-0000-000000001003') INTO result;
  IF result <> 'released' THEN RAISE EXCEPTION 'Unexpected refund result'; END IF;
  -- Force a subtransaction failure after the real SQL function writes.
  RAISE EXCEPTION 'deliberate_rollback';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM <> 'deliberate_rollback' THEN RAISE; END IF;
 END;
 IF EXISTS (SELECT 1 FROM public.xoxo_reveal_quota_reservations
  WHERE id='00000000-0000-0000-0000-000000001003'
  AND released_at IS NOT NULL) THEN
  RAISE EXCEPTION 'Quota release survived failed subtransaction';
 END IF;
 SELECT public.xoxo_reveal_release_quota_v2(
  '00000000-0000-0000-0000-000000001001',
  '00000000-0000-0000-0000-000000001002',
  '00000000-0000-0000-0000-000000001003') INTO result;
 IF result <> 'released' THEN RAISE EXCEPTION 'Refund retry failed after rollback'; END IF;
END $tests$;
ROLLBACK;
