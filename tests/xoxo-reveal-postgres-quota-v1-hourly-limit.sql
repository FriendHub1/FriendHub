-- Isolated quota CI: validate actual 120/hour reservation cap.
DO $guard$
BEGIN
 IF current_database()<>'xoxo_reveal_quota_ci' OR current_user<>'xoxo_test'
 THEN RAISE EXCEPTION 'Wrong database or user'; END IF;
END $guard$;
INSERT INTO auth.users(id) VALUES ('44444444-4444-4444-8444-444444444444');
SELECT set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',false);
DO $limit$
DECLARE i integer; v_before bigint; v_result uuid;
BEGIN
 FOR i IN 1..120 LOOP
  SELECT public.xoxo_reveal_reserve_quota_v1(1024) INTO v_result;
  IF v_result IS NULL THEN RAISE EXCEPTION 'Reservation % failed',i; END IF;
 END LOOP;
 SELECT count(*) INTO v_before FROM public.xoxo_reveal_quota_reservations
 WHERE sender_id='44444444-4444-4444-8444-444444444444' AND released_at IS NULL;
 IF v_before<>120 THEN RAISE EXCEPTION 'Expected 120 reservations, got %',v_before; END IF;
 BEGIN
  PERFORM public.xoxo_reveal_reserve_quota_v1(1024);
  RAISE EXCEPTION '121st reservation unexpectedly succeeded';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'Reveal quota exceeded' THEN RAISE; END IF;
 END;
 IF (SELECT count(*) FROM public.xoxo_reveal_quota_reservations
  WHERE sender_id='44444444-4444-4444-8444-444444444444' AND released_at IS NULL)<>120
 THEN RAISE EXCEPTION 'Over-limit request mutated reservations'; END IF;
END $limit$;
SELECT set_config('request.jwt.claim.sub','',false);
