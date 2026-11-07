-- Disposable PostgreSQL: a refund restores hourly byte capacity.
DO $guard$
BEGIN
 IF current_database()<>'xoxo_reveal_quota_ci' OR current_user<>'xoxo_test'
 THEN RAISE EXCEPTION 'Wrong database or user'; END IF;
END $guard$;
INSERT INTO auth.users(id) VALUES ('88888888-8888-4888-8888-888888888888');
SELECT set_config('request.jwt.claim.sub','88888888-8888-4888-8888-888888888888',false);
DO $reuse$
DECLARE i integer; v_first uuid; v_id uuid; v_ok boolean; v_active bigint; v_bytes bigint;
BEGIN
 FOR i IN 1..80 LOOP
  SELECT public.xoxo_reveal_reserve_quota_v1(15728640) INTO v_id;
  IF i=1 THEN v_first:=v_id; END IF;
 END LOOP;
 BEGIN
  PERFORM public.xoxo_reveal_reserve_quota_v1(1);
  RAISE EXCEPTION 'Over-limit byte reservation unexpectedly succeeded';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'Reveal quota exceeded' THEN RAISE; END IF;
 END;
 SELECT public.xoxo_reveal_release_quota_v1(
  v_first,'88888888-8888-4888-8888-888888888888') INTO v_ok;
 IF v_ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'Release failed'; END IF;
 SELECT public.xoxo_reveal_reserve_quota_v1(15728640) INTO v_id;
 IF v_id IS NULL OR v_id=v_first THEN RAISE EXCEPTION 'Released byte capacity not reusable'; END IF;
 SELECT count(*),coalesce(sum(byte_count),0) INTO v_active,v_bytes
 FROM public.xoxo_reveal_quota_reservations
 WHERE sender_id='88888888-8888-4888-8888-888888888888' AND released_at IS NULL;
 IF v_active<>80 OR v_bytes<>1200::bigint*1024*1024
 THEN RAISE EXCEPTION 'Incorrect active byte quota after refund and replacement'; END IF;
END $reuse$;
SELECT set_config('request.jwt.claim.sub','',false);
