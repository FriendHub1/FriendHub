-- Disposable PostgreSQL 16 only, after writer-lease SQL and verification SQL.
DO $guard$
BEGIN
 IF current_database()<>'xoxo_reveal_test_ci' OR current_user<>'xoxo_test'
 THEN RAISE EXCEPTION 'Wrong isolated target'; END IF;
END $guard$;
BEGIN;
SET LOCAL request.jwt.claim.role='service_role';
INSERT INTO public.xoxo_reveal_upload_attempts(
 id,sender_id,status,claim_token,writer_state,writer_token,writer_lease_expires_at)
VALUES(
 '00000000-0000-0000-0000-000000005001',
 '00000000-0000-0000-0000-000000005002','pending',
 '00000000-0000-0000-0000-000000005003','writing',
 '00000000-0000-0000-0000-000000005004',clock_timestamp()+interval '60 seconds');
DO $tests$
BEGIN
 IF NOT public.xoxo_reveal_verify_writer_v1(
  '00000000-0000-0000-0000-000000005001',
  '00000000-0000-0000-0000-000000005002',
  '00000000-0000-0000-0000-000000005004')
 THEN RAISE EXCEPTION 'Owner not verified'; END IF;
 IF public.xoxo_reveal_verify_writer_v1(
  '00000000-0000-0000-0000-000000005001',
  '00000000-0000-0000-0000-000000005002',
  '00000000-0000-0000-0000-000000005005')
 THEN RAISE EXCEPTION 'Wrong writer verified'; END IF;
END $tests$;
UPDATE public.xoxo_reveal_upload_attempts
SET writer_lease_expires_at=clock_timestamp()-interval '1 second'
WHERE id='00000000-0000-0000-0000-000000005001';
DO $tests$
BEGIN
 IF public.xoxo_reveal_verify_writer_v1(
  '00000000-0000-0000-0000-000000005001',
  '00000000-0000-0000-0000-000000005002',
  '00000000-0000-0000-0000-000000005004')
 THEN RAISE EXCEPTION 'Expired writer verified'; END IF;
END $tests$;
ROLLBACK;
BEGIN;
SET LOCAL request.jwt.claim.role='authenticated';
DO $tests$
BEGIN
 BEGIN
  PERFORM public.xoxo_reveal_verify_writer_v1(
   '00000000-0000-0000-0000-000000005001',
   '00000000-0000-0000-0000-000000005002',
   '00000000-0000-0000-0000-000000005004');
  RAISE EXCEPTION 'Unexpected authorization';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'Unauthorized' THEN RAISE; END IF;
 END;
END $tests$;
ROLLBACK;
