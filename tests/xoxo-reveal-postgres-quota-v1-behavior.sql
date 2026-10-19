-- Disposable PostgreSQL ONLY: real quota v1 refund behavior.
DO $guard$
BEGIN
 IF current_database()<>'xoxo_reveal_quota_ci' OR current_user<>'xoxo_test'
 THEN RAISE EXCEPTION 'Wrong database or user'; END IF;
END $guard$;
-- auth.uid() is NULL in this isolated fixture. No anonymous reservation
-- may be created, even when a valid byte count is supplied.
DO $unauth$
DECLARE v_before bigint;
BEGIN
 SELECT count(*) INTO v_before FROM public.xoxo_reveal_quota_reservations;
 BEGIN
  PERFORM public.xoxo_reveal_reserve_quota_v1(1024);
  RAISE EXCEPTION 'Unauthenticated reservation unexpectedly succeeded';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM <> 'Authentication required' THEN RAISE; END IF;
 END;
 IF (SELECT count(*) FROM public.xoxo_reveal_quota_reservations) <> v_before
 THEN RAISE EXCEPTION 'Unauthenticated reservation mutated quota'; END IF;
END $unauth$;
INSERT INTO auth.users(id) VALUES
 ('11111111-1111-4111-8111-111111111111'),
 ('22222222-2222-4222-8222-222222222222');
INSERT INTO public.xoxo_reveal_quota_reservations(id,sender_id,byte_count)
VALUES ('33333333-3333-4333-8333-333333333333',
        '11111111-1111-4111-8111-111111111111',1024);
DO $test$
DECLARE v_result boolean;
BEGIN
 SELECT public.xoxo_reveal_release_quota_v1(
  '33333333-3333-4333-8333-333333333333',
  '22222222-2222-4222-8222-222222222222') INTO v_result;
 IF v_result IS DISTINCT FROM false THEN RAISE EXCEPTION 'Wrong owner refund succeeded'; END IF;
 IF EXISTS (SELECT 1 FROM public.xoxo_reveal_quota_reservations
  WHERE id='33333333-3333-4333-8333-333333333333' AND released_at IS NOT NULL)
 THEN RAISE EXCEPTION 'Wrong owner mutated reservation'; END IF;
 SELECT public.xoxo_reveal_release_quota_v1(
  '33333333-3333-4333-8333-333333333333',
  '11111111-1111-4111-8111-111111111111') INTO v_result;
 IF v_result IS DISTINCT FROM true THEN RAISE EXCEPTION 'First refund failed'; END IF;
 SELECT public.xoxo_reveal_release_quota_v1(
  '33333333-3333-4333-8333-333333333333',
  '11111111-1111-4111-8111-111111111111') INTO v_result;
 IF v_result IS DISTINCT FROM false THEN RAISE EXCEPTION 'Duplicate refund succeeded'; END IF;
END $test$;
