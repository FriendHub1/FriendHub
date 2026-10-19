-- Disposable PostgreSQL: a released quota reservation stops counting.
DO $guard$
BEGIN
 IF current_database()<>'xoxo_reveal_quota_ci' OR current_user<>'xoxo_test'
 THEN RAISE EXCEPTION 'Wrong database or user'; END IF;
END $guard$;
INSERT INTO auth.users(id) VALUES ('77777777-7777-4777-8777-777777777777');
SELECT set_config('request.jwt.claim.sub','77777777-7777-4777-8777-777777777777',false);
DO $reuse$
DECLARE i integer; v_first uuid; v_new uuid; v_ok boolean; v_count bigint;
BEGIN
 FOR i IN 1..120 LOOP
  SELECT public.xoxo_reveal_reserve_quota_v1(1024) INTO v_new;
  IF i=1 THEN v_first:=v_new; END IF;
 END LOOP;
 SELECT public.xoxo_reveal_release_quota_v1(
  v_first,'77777777-7777-4777-8777-777777777777') INTO v_ok;
 IF v_ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'Release failed'; END IF;
 SELECT public.xoxo_reveal_reserve_quota_v1(1024) INTO v_new;
 IF v_new IS NULL OR v_new=v_first THEN RAISE EXCEPTION 'Quota slot not reusable'; END IF;
 SELECT count(*) INTO v_count FROM public.xoxo_reveal_quota_reservations
 WHERE sender_id='77777777-7777-4777-8777-777777777777' AND released_at IS NULL;
 IF v_count<>120 THEN RAISE EXCEPTION 'Expected 120 active slots, got %',v_count; END IF;
END $reuse$;
SELECT set_config('request.jwt.claim.sub','',false);
