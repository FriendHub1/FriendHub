-- Disposable PostgreSQL only: verify 1200 MiB/hour byte cap.
DO $guard$
BEGIN
 IF current_database()<>'xoxo_reveal_quota_ci' OR current_user<>'xoxo_test'
 THEN RAISE EXCEPTION 'Wrong database or user'; END IF;
END $guard$;
INSERT INTO auth.users(id) VALUES ('55555555-5555-4555-8555-555555555555');
SELECT set_config('request.jwt.claim.sub','55555555-5555-4555-8555-555555555555',false);
DO $bytes$
DECLARE i integer; v_count bigint; v_bytes bigint;
BEGIN
 FOR i IN 1..80 LOOP
  PERFORM public.xoxo_reveal_reserve_quota_v1(15728640);
 END LOOP;
 SELECT count(*),sum(byte_count) INTO v_count,v_bytes
 FROM public.xoxo_reveal_quota_reservations
 WHERE sender_id='55555555-5555-4555-8555-555555555555' AND released_at IS NULL;
 IF v_count<>80 OR v_bytes<>1200::bigint*1024*1024
 THEN RAISE EXCEPTION 'Expected 80 reservations totaling 1200 MiB'; END IF;
 BEGIN
  PERFORM public.xoxo_reveal_reserve_quota_v1(1);
  RAISE EXCEPTION 'Exceeded byte cap';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'Reveal quota exceeded' THEN RAISE; END IF;
 END;
 IF (SELECT count(*) FROM public.xoxo_reveal_quota_reservations
  WHERE sender_id='55555555-5555-4555-8555-555555555555' AND released_at IS NULL)<>80
 THEN RAISE EXCEPTION 'Over-byte-limit request changed reservations'; END IF;
END $bytes$;
SELECT set_config('request.jwt.claim.sub','',false);
