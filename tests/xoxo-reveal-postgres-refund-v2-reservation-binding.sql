-- XOXO Reveal BETA: actual refund v2 SQL must reject reservation swapping.
-- Disposable PostgreSQL only; run after refund v2 setup/migration.
DO $guard$
BEGIN
 IF current_database()<>'xoxo_reveal_test_ci' OR current_user<>'xoxo_test'
 THEN RAISE EXCEPTION 'Wrong isolated target'; END IF;
END $guard$;
BEGIN;
SET LOCAL request.jwt.claim.role='service_role';
INSERT INTO public.xoxo_reveal_upload_attempts(id,sender_id,status)
VALUES
 ('00000000-0000-0000-0000-000000000801','00000000-0000-0000-0000-000000000901','failed'),
 ('00000000-0000-0000-0000-000000000802','00000000-0000-0000-0000-000000000901','failed');
INSERT INTO public.xoxo_reveal_quota_reservations(id,sender_id,upload_attempt_id)
VALUES
 ('00000000-0000-0000-0000-000000000803','00000000-0000-0000-0000-000000000901','00000000-0000-0000-0000-000000000801'),
 ('00000000-0000-0000-0000-000000000804','00000000-0000-0000-0000-000000000901','00000000-0000-0000-0000-000000000802');
DO $tests$
BEGIN
 BEGIN
  PERFORM public.xoxo_reveal_release_quota_v2(
   '00000000-0000-0000-0000-000000000801',
   '00000000-0000-0000-0000-000000000901',
   '00000000-0000-0000-0000-000000000804');
  RAISE EXCEPTION 'Swapped reservation unexpectedly released';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM <> 'Reservation not found' THEN RAISE; END IF;
 END;
 BEGIN
  PERFORM public.xoxo_reveal_release_quota_v2(
   '00000000-0000-0000-0000-000000000801',
   '00000000-0000-0000-0000-000000000901',
   '00000000-0000-0000-0000-000000000805');
  RAISE EXCEPTION 'Unknown reservation unexpectedly released';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM <> 'Reservation not found' THEN RAISE; END IF;
 END;
 IF EXISTS (
  SELECT 1 FROM public.xoxo_reveal_quota_reservations
  WHERE id IN (
   '00000000-0000-0000-0000-000000000803',
   '00000000-0000-0000-0000-000000000804'
  ) AND released_at IS NOT NULL
 ) THEN RAISE EXCEPTION 'Rejected request changed quota'; END IF;
END $tests$;
ROLLBACK;
