-- Disposable PostgreSQL recipient claim tests.
DO $t$
DECLARE s uuid:='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 r uuid:='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 other_r uuid:='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
 key_text text:='claim_recipient_test_1234';
 fingerprint text:=repeat('a',64);
 result_row record;
BEGIN
 PERFORM set_config('request.jwt.claim.role','service_role',true);
 SELECT * INTO result_row FROM public.xoxo_reveal_claim_upload_v2(s,r,key_text,fingerprint);
 IF result_row.action<>'claimed' OR result_row.owner_token IS NULL THEN
  RAISE EXCEPTION 'First recipient claim failed';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.xoxo_reveal_upload_attempts
  WHERE id=result_row.attempt_id AND sender_id=s AND recipient_id=r) THEN
  RAISE EXCEPTION 'Recipient not stored with claim';
 END IF;
 SELECT * INTO result_row FROM public.xoxo_reveal_claim_upload_v2(s,other_r,key_text,fingerprint);
 IF result_row.action<>'reject' THEN
  RAISE EXCEPTION 'Recipient substitution not rejected';
 END IF;
 SELECT * INTO result_row FROM public.xoxo_reveal_claim_upload_v2(s,r,key_text,fingerprint);
 IF result_row.action<>'wait' THEN RAISE EXCEPTION 'Idempotent retry not waiting'; END IF;
 SELECT * INTO result_row FROM public.xoxo_reveal_claim_upload_v2(s,r,key_text,repeat('b',64));
 IF result_row.action<>'reject' THEN RAISE EXCEPTION 'Fingerprint mismatch not rejected'; END IF;
END $t$;
