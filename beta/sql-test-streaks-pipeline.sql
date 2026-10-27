-- ONLY for the fresh disposable PostgreSQL 17 CI database.
\set ON_ERROR_STOP on

-- Three consecutive UTC days of ordinary persistent messages from both people.
insert into public.direct_messages
  (id,sender_id,recipient_id,content,whisper_id,media_view_mode,created_at)
values
 ('88888888-8888-4888-8888-888888888801','11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','fixture',null,'normal',((date_trunc('day',now() at time zone 'UTC') - interval '3 days') + interval '12 hours') at time zone 'UTC'),
 ('88888888-8888-4888-8888-888888888802','22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111','fixture',null,'normal',((date_trunc('day',now() at time zone 'UTC') - interval '3 days') + interval '13 hours') at time zone 'UTC'),
 ('88888888-8888-4888-8888-888888888803','11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','fixture',null,'normal',((date_trunc('day',now() at time zone 'UTC') - interval '2 days') + interval '12 hours') at time zone 'UTC'),
 ('88888888-8888-4888-8888-888888888804','22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111','fixture',null,'normal',((date_trunc('day',now() at time zone 'UTC') - interval '2 days') + interval '13 hours') at time zone 'UTC'),
 ('88888888-8888-4888-8888-888888888805','11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','fixture',null,'normal',((date_trunc('day',now() at time zone 'UTC') - interval '1 day') + interval '12 hours') at time zone 'UTC'),
 ('88888888-8888-4888-8888-888888888806','22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111','fixture',null,'normal',((date_trunc('day',now() at time zone 'UTC') - interval '1 day') + interval '13 hours') at time zone 'UTC'),
 -- Today's one-sided ordinary DM must not make today a mutual day.
 ('88888888-8888-4888-8888-888888888807','11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','fixture',null,'normal',((date_trunc('day',now() at time zone 'UTC')) + interval '12 hours') at time zone 'UTC'),
 -- Whispers and once-view messages do not count as normal activity.
 ('88888888-8888-4888-8888-888888888808','22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111','fixture','99999999-9999-4999-8999-999999999999','normal',((date_trunc('day',now() at time zone 'UTC')) + interval '13 hours') at time zone 'UTC'),
 ('88888888-8888-4888-8888-888888888809','11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','fixture',null,'once',((date_trunc('day',now() at time zone 'UTC')) + interval '14 hours') at time zone 'UTC');

-- Verify neither SECURITY DEFINER function is directly executable by client roles.
-- The trigger can invoke its trigger function without granting direct EXECUTE.
do $security$
declare
  v_role text;
  v_function text;
begin
  foreach v_function in array array[
    'public.xoxo_get_dm_streak(uuid)',
    'public.xoxo_record_dm_streak_activity()'
  ] loop
    foreach v_role in array array['anon','authenticated'] loop
      if has_function_privilege(v_role, v_function, 'EXECUTE') then
        raise exception 'Client role % must not execute % directly', v_role, v_function;
      end if;
    end loop;
  end loop;
end
$security$;

-- Test-only override in this disposable CI database so the calculation contract
-- can still be exercised. Never copy this grant into a deployed migration.
grant execute on function public.xoxo_get_dm_streak(uuid) to authenticated;

set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
set role authenticated;
do $test$
declare r record;
begin
  select * into r from public.xoxo_get_dm_streak('22222222-2222-4222-8222-222222222222');
  if r.current_streak <> 3 or r.longest_streak <> 3
     or r.last_mutual_day <> (now() at time zone 'UTC')::date - 1
     or r.next_milestone <> 7 then
    raise exception 'Expected 3-day streak with next milestone 7; got current %, longest %, last %, next %',
      r.current_streak,r.longest_streak,r.last_mutual_day,r.next_milestone;
  end if;
end
$test$;
reset role;

-- Clearing is per user. The user's own view excludes the cleared UTC day and older activity.
insert into public.dm_conversation_clears(user_id,other_user_id,cleared_at)
values ('11111111-1111-4111-8111-111111111111',
        '22222222-2222-4222-8222-222222222222',
        ((date_trunc('day',now() at time zone 'UTC') - interval '1 day') + interval '15 hours') at time zone 'UTC');

set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
set role authenticated;
do $test$
declare r record;
begin
  select * into r from public.xoxo_get_dm_streak('22222222-2222-4222-8222-222222222222');
  if r.current_streak <> 0 or r.longest_streak <> 0 or r.last_mutual_day is not null then
    raise exception 'Cleared user''s streak must reset; got current %, longest %, last %',
      r.current_streak,r.longest_streak,r.last_mutual_day;
  end if;
end
$test$;
reset role;

-- The other participant's local view is independent and should retain the mutual streak.
set request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
set role authenticated;
do $test$
declare r record;
begin
  select * into r from public.xoxo_get_dm_streak('11111111-1111-4111-8111-111111111111');
  if r.current_streak <> 3 or r.longest_streak <> 3 then
    raise exception 'One participant clearing their view must not reset the peer; got current %, longest %',
      r.current_streak,r.longest_streak;
  end if;
end
$test$;
reset role;
\echo 'PASS: trigger aggregation, UTC mutual streak, Whisper/once-view exclusions, per-user clear semantics'
