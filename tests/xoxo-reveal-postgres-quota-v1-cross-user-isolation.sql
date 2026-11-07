-- Disposable PostgreSQL: one sender's refund cannot change another sender's quota.
DO $guard$
BEGIN
 IF current_database()<>'xoxo_reveal_quota_ci' OR current_user<>'xoxo_test'
 THEN RAISE EXCEPTION 'Wrong database or user'; END IF;
END $guard$;
INSERT INTO auth.users(id) VALUES
 ('99999999-9999-4999-8999-999999999999'),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
SELECT set_config('request.jwt.claim.sub','99999999-9999-4999-8999-999999999999',false);
DO $isolation$
DECLARE i integer; v_a uuid; v_b uuid; v_ok boolean; v_count bigint;
BEGIN
 FOR i IN 1..120 LOOP
  SELECT public.xoxo_reveal_reserve_quota_v1(1024) INTO v_a;
 END LOOP;
 PERFORM set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
 SELECT public.xoxo_reveal_reserve_quota_v1(1024) INTO v_b;
 -- Trusted service may supply a sender id; it must match the reservation owner.
 SELECT public.xoxo_reveal_release_quota_v1(
   v_a,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') INTO v_ok;
 IF v_ok IS DISTINCT FROM false THEN RAISE EXCEPTION 'Cross-owner refund succeeded'; END IF;
 PERFORM set_config('request.jwt.claim.sub','99999999-9999-4999-8999-999999999999',false);
 BEGIN
  PERFORM public.xoxo_reveal_reserve_quota_v1(1024);
  RAISE EXCEPTION 'Cross-owner refund incorrectly freed quota';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM<>'Reveal quota exceeded' THEN RAISE; END IF;
 END;
 SELECT count(*) INTO v_count FROM public.xoxo_reveal_quota_reservations
 WHERE sender_id='99999999-9999-4999-8999-999999999999' AND released_at IS NULL;
 IF v_count<>120 THEN RAISE EXCEPTION 'Original sender quota was modified'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.xoxo_reveal_quota_reservations
  WHERE id=v_b AND sender_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  AND released_at IS NULL)
 THEN RAISE EXCEPTION 'Other sender reservation was modified'; END IF;
END $isolation$;
SELECT set_config('request.jwt.claim.sub','',false);
