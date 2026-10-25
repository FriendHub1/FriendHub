-- XOXO Avenue BETA: disappearing-content evidence safety regression.
-- Run ONLY after the main fixture and SQL contract in disposable PostgreSQL.
-- This file intentionally creates synthetic messages and does not read live DMs.
\set ON_ERROR_STOP on

do $isolated_database_only$
begin
  if current_database() <> 'xoxo_safety_test' or
     to_regclass('xoxo_safety_private.conversation_reports') is null then
    raise exception 'Ephemeral evidence test requires disposable SQL contract DB';
  end if;
end $isolated_database_only$;

-- The peer's older history was cleared during sql-test-report-pipeline.sql.
-- New fixture messages are deliberately sent after the clear, so rejection
-- cannot be mistakenly attributed to a per-user clear or ordinary DM RLS.
insert into public.direct_messages
  (id,sender_id,recipient_id,content,created_at,whisper_id,media_view_mode)
values
  ('77777777-7777-4777-8777-777777777791',
   '11111111-1111-4111-8111-111111111111',
   '22222222-2222-4222-8222-222222222222',
   'Synthetic normal message',clock_timestamp(),null,'normal'),
  ('77777777-7777-4777-8777-777777777792',
   '11111111-1111-4111-8111-111111111111',
   '22222222-2222-4222-8222-222222222222',
   'Synthetic disappearing whisper',clock_timestamp(),
   '44444444-4444-4444-8444-444444444444','normal'),
  ('77777777-7777-4777-8777-777777777793',
   '11111111-1111-4111-8111-111111111111',
   '22222222-2222-4222-8222-222222222222',
   'Synthetic once-view media',clock_timestamp(),null,'once');

set role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
select set_config('request.jwt.claim.session_id','bbbbbbbb-0000-4000-8000-000000000002',false);

do $ephemeral_evidence_contract$
declare
  v_normal uuid := '77777777-7777-4777-8777-777777777791';
  v_whisper uuid := '77777777-7777-4777-8777-777777777792';
  v_once uuid := '77777777-7777-4777-8777-777777777793';
  v_report uuid;
begin
  if (select count(*) from public.direct_messages
      where id in (v_normal,v_whisper,v_once)) <> 3 then
    raise exception 'Fixture error: participant RLS hid the test messages';
  end if;

  begin
    perform public.xoxo_submit_conversation_report_beta(
      '11111111-1111-4111-8111-111111111111',0,'Disappearing whisper',
      array[v_whisper], '88888888-8888-4888-8888-000000000091');
    raise exception 'BUG: a disappearing whisper became report evidence';
  exception when sqlstate '42501' then null; end;

  begin
    perform public.xoxo_submit_conversation_report_beta(
      '11111111-1111-4111-8111-111111111111',0,'Once-view image',
      array[v_once], '88888888-8888-4888-8888-000000000092');
    raise exception 'BUG: once-view media became report evidence';
  exception when sqlstate '42501' then null; end;

  begin
    perform public.xoxo_submit_conversation_report_beta(
      '11111111-1111-4111-8111-111111111111',0,'Mixed whisper and normal',
      array[v_normal,v_whisper], '88888888-8888-4888-8888-000000000093');
    raise exception 'BUG: mixed normal and disappearing evidence was saved';
  exception when sqlstate '42501' then null; end;

  begin
    perform public.xoxo_submit_conversation_report_beta(
      '11111111-1111-4111-8111-111111111111',0,'Mixed once-view and normal',
      array[v_normal,v_once], '88888888-8888-4888-8888-000000000094');
    raise exception 'BUG: mixed normal and once-view evidence was saved';
  exception when sqlstate '42501' then null; end;

  -- This rejection must not disable ordinary reporting in the same chat.
  v_report := public.xoxo_submit_conversation_report_beta(
    '11111111-1111-4111-8111-111111111111',0,'Normal message is allowed',
    array[v_normal], '88888888-8888-4888-8888-000000000095');
  if v_report is null then
    raise exception 'BUG: an ordinary visible DM could not be reported';
  end if;
end $ephemeral_evidence_contract$;

reset role;
do $persistence_audit$
begin
  if (select count(*) from xoxo_safety_private.conversation_reports
      where idempotency_key::text between
      '88888888-8888-4888-8888-000000000091' and
      '88888888-8888-4888-8888-000000000095') <> 1 then
    raise exception 'BUG: blocked ephemeral evidence persisted a report';
  end if;
end $persistence_audit$;

select 'PASS: whispers and once-view evidence rejected; ordinary DMs still reportable' as result;
