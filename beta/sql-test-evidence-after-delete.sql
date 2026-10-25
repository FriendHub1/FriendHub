-- XOXO Avenue safety BETA: evidence metadata and idempotent receipt after
-- physical DM deletion. DISPOSABLE xoxo_safety_test DATABASE ONLY.
-- This exercises the existing draft behavior, NOT a final retention policy.
\set ON_ERROR_STOP on

do $check_disposable$
begin
  if current_database() <> 'xoxo_safety_test' then
    raise exception 'Refusing report deletion regression on non-test DB';
  end if;
end $check_disposable$;

reset role;
-- Original successful report from the sequential integration test.
select set_config('xoxo.safety_delete_report_id',(
  select id::text from xoxo_safety_private.conversation_reports
   where reporter_id='11111111-1111-4111-8111-111111111111'::uuid
     and idempotency_key='88888888-8888-4888-8888-000000000001'::uuid
),false);

do $before_delete$
declare v_report uuid:=nullif(current_setting('xoxo.safety_delete_report_id',true),'')::uuid;
begin
  if v_report is null then
    raise exception 'BUG: original successful report not found';
  end if;
  if (select count(*) from xoxo_safety_private.conversation_report_evidence
      where report_id=v_report) <> 1 then
    raise exception 'BUG: original selected evidence metadata missing';
  end if;
  -- The preceding SQL integration suite already deleted this message.
  -- Confirm the test is truly exercising a permanently missing DM.
  if exists(select 1 from public.direct_messages
      where id='77777777-7777-4777-8777-777777777771'::uuid) then
    raise exception 'BUG: baseline test did not delete reported message';
  end if;
end $before_delete$;

-- The baseline SQL suite ALREADY physically deleted the source DM.
-- The additional regression below verifies old metadata and the immutable
-- idempotent receipt without restoring or recreating message content.

do $after_delete$
declare v_report uuid:=current_setting('xoxo.safety_delete_report_id')::uuid;
begin
  if (select count(*) from xoxo_safety_private.conversation_reports
      where id=v_report) <> 1 then
    raise exception 'BUG: deleted DM also removed the moderation report';
  end if;
  if (select count(*) from xoxo_safety_private.conversation_report_evidence
      where report_id=v_report and
            message_id='77777777-7777-4777-8777-777777777771'::uuid) <> 1 then
    raise exception 'BUG: deleted DM also removed its previously saved metadata';
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema='xoxo_safety_private'
      and table_name='conversation_report_evidence'
      and column_name in ('content','message_text','message_body','attachment_path')
  ) then
    raise exception 'BUG: moderation evidence schema unexpectedly snapshots private DM contents';
  end if;
end $after_delete$;

-- Return the exact historical receipt for a previously accepted request,
-- even if the message was physically deleted; never create another report.
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
select set_config('request.jwt.claim.session_id','aaaaaaaa-0000-4000-8000-000000000001',false);
do $deleted_receipt$
declare
  v_expected uuid:=current_setting('xoxo.safety_delete_report_id')::uuid;
  v_returned uuid;
begin
  v_returned:=public.xoxo_submit_conversation_report_beta(
    '22222222-2222-4222-8222-222222222222'::uuid,
    1,'Threats',
    array['77777777-7777-4777-8777-777777777771'::uuid],
    '88888888-8888-4888-8888-000000000001'::uuid
  );
  if v_returned<>v_expected then
    raise exception 'BUG: retry after message deletion changed original receipt';
  end if;

  -- A replay cannot alter any of the original report's immutable
  -- fields, even after the source message is physically deleted.
  begin
    perform public.xoxo_submit_conversation_report_beta(
      '22222222-2222-4222-8222-222222222222'::uuid,
      1,'Changed report details',
      array['77777777-7777-4777-8777-777777777771'::uuid],
      '88888888-8888-4888-8888-000000000001'::uuid
    );
    raise exception 'BUG: replay changed report details';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.xoxo_submit_conversation_report_beta(
      '22222222-2222-4222-8222-222222222222'::uuid,
      2,'Threats',
      array['77777777-7777-4777-8777-777777777771'::uuid],
      '88888888-8888-4888-8888-000000000001'::uuid
    );
    raise exception 'BUG: replay changed reported reason';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.xoxo_submit_conversation_report_beta(
      '33333333-3333-4333-8333-333333333333'::uuid,
      1,'Threats',
      array['77777777-7777-4777-8777-777777777771'::uuid],
      '88888888-8888-4888-8888-000000000001'::uuid
    );
    raise exception 'BUG: replay changed reported participant';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.xoxo_submit_conversation_report_beta(
      '22222222-2222-4222-8222-222222222222'::uuid,
      1,'Threats',
      array['77777777-7777-4777-8777-777777777772'::uuid],
      '88888888-8888-4888-8888-000000000001'::uuid
    );
    raise exception 'BUG: replay swapped selected evidence ID';
  exception when sqlstate '22023' then null; end;
end $deleted_receipt$;

reset role;
-- Even after the source DM was physically removed, a PIN-authorized admin
-- can see how many selected IDs are missing WITHOUT reading/copying content.
-- Earlier tests can create over 100 reports, so navigate real cursor pages.
update public.xoxo_moderation_pin_security
   set verified_until=now()+interval '5 minutes', locked_until=null
 where admin_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid;
set role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
select set_config('request.jwt.claim.session_id','cccccccc-0000-4000-8000-000000000003',false);
do $missing_evidence_queue$
declare
  v_report uuid:=current_setting('xoxo.safety_delete_report_id')::uuid;
  v_cursor jsonb:=null;
  v_page jsonb;
  v_row jsonb;
  v_found boolean:=false;
begin
  for attempt in 1..20 loop
    v_page:=public.xoxo_admin_page_conversation_reports_beta(
      'Reviewing unavailable evidence after physical DM deletion',
      (v_cursor->>'pending')::boolean,
      (v_cursor->>'created_at')::timestamptz,
      (v_cursor->>'id')::uuid,50
    );
    select evidence into v_row from jsonb_array_elements(v_page->'reports') evidence
     where evidence->>'id'=v_report::text;
    if v_row is not null then
      if (v_row->>'unavailable_evidence_count')::integer<>1 then
        raise exception 'BUG: missing DM evidence count was not retained in PIN queue';
      end if;
      if v_row ? 'content' or v_row ? 'attachment_path' then
        raise exception 'BUG: PIN report metadata exposed DM content';
      end if;
      v_found:=true;
      exit;
    end if;
    exit when not coalesce((v_page->>'has_more')::boolean,false);
    v_cursor:=v_page->'next_cursor';
    if v_cursor is null then
      raise exception 'BUG: report pagination lost its next cursor';
    end if;
  end loop;
  if not v_found then
    raise exception 'BUG: deleted-message evidence report vanished from admin pages';
  end if;
end $missing_evidence_queue$;

reset role;
do $final_integrity$
declare v_report uuid:=current_setting('xoxo.safety_delete_report_id')::uuid;
begin
  if (select count(*) from xoxo_safety_private.conversation_reports
       where id=v_report)<>1 or
     (select count(*) from xoxo_safety_private.conversation_report_evidence
       where report_id=v_report)<>1 then
    raise exception 'BUG: historical report or evidence metadata duplicated';
  end if;
end $final_integrity$;

\echo 'PASS: accepted report and selected evidence metadata survive physical DM deletion, immutable idempotency receipt is recoverable without copying message text'
