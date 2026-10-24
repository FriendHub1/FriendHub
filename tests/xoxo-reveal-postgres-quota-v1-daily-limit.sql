-- Disposable PostgreSQL: daily quota boundary independent of hourly cap.
DO $guard$
BEGIN
 IF current_database()<>'xoxo_reveal_quota_ci' OR current_user<>'xoxo_test'
 THEN RAISE EXCEPTION 'Wrong database or user'; END IF;
END $guard$;
INSERT INTO auth.users(id) VALUES ('66666666-6666-4666-8666-666666666666');
-- Seed 599 earlier-in-day reservations outside the rolling hour.
INSERT INTO public.xoxo_reveal_quota_reservations(sender_id,byte_count,created_at)
SELECT '66666666-6666-4666-8666-666666666666',1024,clock_timestamp()-interval '2 hours'
FROM generate_series(1,599);
SELECT set_config('request.jwt.claim.sub','66666666-6666-4666-8666-666666666666',false);
DO $daily$
DECLARE v_id uuid; v_count bigint;
BEGIN
 SELECT public.xoxo_reveal_reserve_quota_v1(1024) INTO v_id;
 IF v_id IS NULL THEN RAISE EXCEPTION '600th daily reservation failed'; END IF;
 BEGIN
  PERFORM public.xoxo_reveal_reserve_quota_v1(1024);
  RAISE EXCEPTION '601st daily reservation succeeded';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'Reveal quota exceeded' THEN RAISE; END IF;
 END;
 SELECT count(*) INTO v_count FROM public.xoxo_reveal_quota_reservations
 WHERE sender_id='66666666-6666-4666-8666-666666666666' AND released_at IS NULL;
 IF v_count<>600 THEN RAISE EXCEPTION 'Daily cap changed reservation count: %',v_count; END IF;
END $daily$;
SELECT set_config('request.jwt.claim.sub','',false);
