-- Disposable PostgreSQL only, after setup and writer-lease draft.
DO $guard$
BEGIN
 IF current_database()<>'xoxo_reveal_test_ci' OR current_user<>'xoxo_test'
 THEN RAISE EXCEPTION 'Wrong isolated target'; END IF;
END $guard$;
BEGIN;
SET LOCAL request.jwt.claim.role='service_role';
INSERT INTO public.xoxo_reveal_upload_attempts(id,sender_id,status,claim_token)
VALUES
 ('00000000-0000-0000-0000-000000003001',
  '00000000-0000-0000-0000-000000003002','pending',
  '00000000-0000-0000-0000-000000003003'),
 ('00000000-0000-0000-0000-000000003011',
  '00000000-0000-0000-0000-000000003002','pending',
  '00000000-0000-0000-0000-000000003003');
DO $tests$
DECLARE outcome text;
BEGIN
 SELECT public.xoxo_reveal_claim_writer_v1(
  '00000000-0000-0000-0000-000000003001',
  '00000000-0000-0000-0000-000000003002',
  '00000000-0000-0000-0000-000000003003',
  '00000000-0000-0000-0000-000000003004',60) INTO outcome;
 IF outcome<>'claimed' THEN RAISE EXCEPTION 'Claim failed: %',outcome; END IF;
 SELECT public.xoxo_reveal_claim_writer_v1(
  '00000000-0000-0000-0000-000000003001',
  '00000000-0000-0000-0000-000000003002',
  '00000000-0000-0000-0000-000000003003',
  '00000000-0000-0000-0000-000000003004',60) INTO outcome;
 IF outcome<>'already_owned' THEN RAISE EXCEPTION 'Retry not idempotent: %',outcome; END IF;
 SELECT public.xoxo_reveal_claim_writer_v1(
  '00000000-0000-0000-0000-000000003001',
  '00000000-0000-0000-0000-000000003002',
  '00000000-0000-0000-0000-000000003003',
  '00000000-0000-0000-0000-000000003005',60) INTO outcome;
 IF outcome<>'busy' THEN RAISE EXCEPTION 'Concurrent writer accepted: %',outcome; END IF;
 UPDATE public.xoxo_reveal_upload_attempts
 SET writer_lease_expires_at=now()-interval '1 second'
 WHERE id='00000000-0000-0000-0000-000000003001';
 SELECT public.xoxo_reveal_claim_writer_v1(
  '00000000-0000-0000-0000-000000003001',
  '00000000-0000-0000-0000-000000003002',
  '00000000-0000-0000-0000-000000003003',
  '00000000-0000-0000-0000-000000003005',60) INTO outcome;
 IF outcome<>'manual_reconciliation' THEN RAISE EXCEPTION 'Expired lease stolen: %',outcome; END IF;
 SELECT public.xoxo_reveal_claim_writer_v1(
  '00000000-0000-0000-0000-000000003001',
  '00000000-0000-0000-0000-000000003002',
  '00000000-0000-0000-0000-000000003003',
  '00000000-0000-0000-0000-000000003004',60) INTO outcome;
 IF outcome<>'manual_reconciliation' THEN
  RAISE EXCEPTION 'Original writer bypassed quarantine: %',outcome;
 END IF;
 IF EXISTS (SELECT 1 FROM public.xoxo_reveal_upload_attempts
  WHERE id='00000000-0000-0000-0000-000000003001'
  AND (writer_state<>'needs_reconciliation' OR writer_generation<>1))
 THEN RAISE EXCEPTION 'Expired writer state or generation corrupted'; END IF;
 SELECT public.xoxo_reveal_claim_writer_v1(
  '00000000-0000-0000-0000-000000003011',
  '00000000-0000-0000-0000-000000003002',
  '00000000-0000-0000-0000-000000003099',
  '00000000-0000-0000-0000-000000003004',60) INTO outcome;
 IF outcome<>'not_owner' THEN RAISE EXCEPTION 'Wrong claim token accepted: %',outcome; END IF;
END $tests$;
ROLLBACK;
BEGIN;
SET LOCAL request.jwt.claim.role='authenticated';
DO $tests$
BEGIN
 BEGIN
  PERFORM public.xoxo_reveal_claim_writer_v1(
   '00000000-0000-0000-0000-000000003001',
   '00000000-0000-0000-0000-000000003002',
   '00000000-0000-0000-0000-000000003003',
   '00000000-0000-0000-0000-000000003004',60);
  RAISE EXCEPTION 'Unexpected authorization';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'Unauthorized' THEN RAISE; END IF;
 END;
END $tests$;
ROLLBACK;
