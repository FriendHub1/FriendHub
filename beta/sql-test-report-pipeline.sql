-- XOXO Avenue / run AFTER sql-test-fixtures.sql and schema.sql
-- Disposable PostgreSQL 17 database ONLY. Never execute against live Supabase.
\set ON_ERROR_STOP on

do $$
begin
  if has_schema_privilege('authenticated','xoxo_safety_private','USAGE') then
    raise exception 'BUG: signed-in user can access private report schema';
  end if;
  if has_function_privilege('anon',
    'public.xoxo_submit_conversation_report_beta(uuid,integer,text,uuid[],uuid)','EXECUTE') then
    raise exception 'BUG: anonymous user may submit reports';
  end if;
  if not has_function_privilege('authenticated',
    'public.xoxo_submit_conversation_report_beta(uuid,integer,text,uuid[],uuid)','EXECUTE') then
    raise exception 'BUG: signed-in users cannot call submission RPC';
  end if;
  if has_function_privilege('anon',
    'public.xoxo_admin_list_conversation_reports_beta(text)','EXECUTE') or
     has_function_privilege('anon',
    'public.xoxo_admin_update_conversation_report_beta(uuid,text,text)','EXECUTE') then
    raise exception 'BUG: anonymous caller can execute a moderation RPC';
  end if;
  if not has_function_privilege('authenticated',
    'public.xoxo_admin_list_conversation_reports_beta(text)','EXECUTE') or
     not has_function_privilege('authenticated',
    'public.xoxo_admin_update_conversation_report_beta(uuid,text,text)','EXECUTE') then
    raise exception 'BUG: authenticated moderator cannot call guarded admin RPC';
  end if;
  if has_table_privilege('authenticated',
    'xoxo_safety_private.conversation_reports','SELECT') or
     has_table_privilege('authenticated',
    'xoxo_safety_private.conversation_report_evidence','SELECT') then
    raise exception 'BUG: private report tables readable without the PIN RPC';
  end if;
end $$;

-- Fake JWT subject values are injected by THIS LOCAL TEST FIXTURE,
-- exactly as PostgREST would supply them in a separate real Supabase test.
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
select set_config('request.jwt.claim.session_id','aaaaaaaa-0000-4000-8000-000000000001',false);

-- Verify sensitive reporting requires a CURRENT auth.sessions row.
-- A JWT with a valid user subject but no session or somebody else's session
-- must be refused by the SECURITY DEFINER submission RPC.
select set_config('request.jwt.claim.session_id','',false);
do $$
begin
  begin
    perform public.xoxo_submit_conversation_report_beta(
      '22222222-2222-4222-8222-222222222222',1,'No signed session',
      array['77777777-7777-4777-8777-777777777771'::uuid],
      '88888888-8888-4888-8888-100000000001');
    raise exception 'BUG: missing session_id was accepted';
  exception when sqlstate '28000' then null; end;
end $$;
select set_config('request.jwt.claim.session_id','bbbbbbbb-0000-4000-8000-000000000002',false);
do $$
begin
  begin
    perform public.xoxo_submit_conversation_report_beta(
      '22222222-2222-4222-8222-222222222222',1,'Session owned by another user',
      array['77777777-7777-4777-8777-777777777771'::uuid],
      '88888888-8888-4888-8888-100000000002');
    raise exception 'BUG: session_id of another user was accepted';
  exception when sqlstate '28000' then null; end;
end $$;
select set_config('request.jwt.claim.session_id','aaaaaaaa-0000-4000-8000-000000000001',false);

-- The disposable fixture enforces the same sender/recipient RLS as production.
-- The user's direct SELECT must expose only the two messages of their own chat.
do $$
begin
  if (select count(*) from public.direct_messages) <> 2 then
    raise exception 'BUG: fixture RLS leaked or hid DM rows for reporting user';
  end if;
end $$;

do $$
declare
  v_first uuid;
  v_retry uuid;
  v_second uuid;
  i integer;
  v_key uuid;
begin
  v_first := public.xoxo_submit_conversation_report_beta(
    '22222222-2222-4222-8222-222222222222',1,'Threats',
    array['77777777-7777-4777-8777-777777777771'::uuid],
    '88888888-8888-4888-8888-000000000001'
  );
  if v_first is null then raise exception 'BUG: valid submission returned NULL'; end if;

  v_retry := public.xoxo_submit_conversation_report_beta(
    '22222222-2222-4222-8222-222222222222',1,'Threats',
    array['77777777-7777-4777-8777-777777777771'::uuid],
    '88888888-8888-4888-8888-000000000001'
  );
  if v_retry <> v_first then raise exception 'BUG: idempotent retries duplicated report'; end if;

  begin
    perform public.xoxo_submit_conversation_report_beta(
      '22222222-2222-4222-8222-222222222222',2,'Different request',
      array['77777777-7777-4777-8777-777777777771'::uuid],
      '88888888-8888-4888-8888-000000000001'
    );
    raise exception 'BUG: reuse of key with other content succeeded';
  exception when sqlstate '22023' then null; end;

  begin
    perform public.xoxo_submit_conversation_report_beta(
      '22222222-2222-4222-8222-222222222222',1,'Duplicate evidence',
      array['77777777-7777-4777-8777-777777777771'::uuid,
            '77777777-7777-4777-8777-777777777771'::uuid],
      '88888888-8888-4888-8888-000000000002'
    );
    raise exception 'BUG: duplicate evidence accepted';
  exception when sqlstate '22023' then null; end;

  begin
    perform public.xoxo_submit_conversation_report_beta(
      '22222222-2222-4222-8222-222222222222',1,'Other conversation',
      array['77777777-7777-4777-8777-777777777773'::uuid],
      '88888888-8888-4888-8888-000000000002'
    );
    raise exception 'BUG: outsider evidence accepted';
  exception when sqlstate '42501' then null; end;

  begin
    perform public.xoxo_submit_conversation_report_beta(
      '22222222-2222-4222-8222-222222222222',1,'Missing evidence',
      array['55555555-5555-4555-8555-555555555555'::uuid],
      '88888888-8888-4888-8888-000000000002'
    );
    raise exception 'BUG: deleted/unknown evidence accepted';
  exception when sqlstate '42501' then null; end;

  begin
    perform public.xoxo_submit_conversation_report_beta(
      '22222222-2222-4222-8222-222222222222',1,'Too many',
      array_fill('77777777-7777-4777-8777-777777777771'::uuid,array[21]),
      '88888888-8888-4888-8888-000000000002'
    );
    raise exception 'BUG: 21 evidence items accepted';
  exception when sqlstate '22023' then null; end;

  v_second := public.xoxo_submit_conversation_report_beta(
    '22222222-2222-4222-8222-222222222222',0,'Multiple valid messages',
    array['77777777-7777-4777-8777-777777777771'::uuid,
          '77777777-7777-4777-8777-777777777772'::uuid],
    '88888888-8888-4888-8888-000000000002'
  );
  if v_second is null or v_second = v_first then
    raise exception 'BUG: valid multi-evidence report not created';
  end if;

  for i in 3..10 loop
    v_key := ('88888888-8888-4888-8888-'||lpad(i::text,12,'0'))::uuid;
    perform public.xoxo_submit_conversation_report_beta(
      '22222222-2222-4222-8222-222222222222',0,'Rate limit fixture',
      array['77777777-7777-4777-8777-777777777772'::uuid],v_key
    );
  end loop;

  begin
    perform public.xoxo_submit_conversation_report_beta(
      '22222222-2222-4222-8222-222222222222',0,'11th report',
      array['77777777-7777-4777-8777-777777777772'::uuid],
      '88888888-8888-4888-8888-000000000011'
    );
    raise exception 'BUG: 11th report accepted';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'Daily report limit reached' then raise; end if;
  end;
end $$;

-- User-cleared conversations must also be rejected SERVER-SIDE.
reset role;
insert into public.dm_conversation_clears(user_id,other_user_id,cleared_at) values
 ('22222222-2222-4222-8222-222222222222',
  '11111111-1111-4111-8111-111111111111',now());
set role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
select set_config('request.jwt.claim.session_id','bbbbbbbb-0000-4000-8000-000000000002',false);
do $$
begin
  if (select count(*) from public.direct_messages) <> 1 then
    raise exception 'BUG: clearing a DM exposed previously cleared messages';
  end if;
  if (select count(*) from public.dm_conversation_clears) <> 1 then
    raise exception 'BUG: reporting user cannot read their own cleared state';
  end if;
  begin
    perform public.xoxo_submit_conversation_report_beta(
      '11111111-1111-4111-8111-111111111111',3,'Already cleared',
      array['77777777-7777-4777-8777-777777777771'::uuid],
      '88888888-8888-4888-8888-000000000012'
    );
    raise exception 'BUG: cleared message accepted';
  exception when sqlstate '42501' then null; end;
end $$;

-- Cleared conversation rows are private: other participants cannot
-- inspect when a user personally clears their chat.
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
select set_config('request.jwt.claim.session_id','aaaaaaaa-0000-4000-8000-000000000001',false);
do $$
begin
  if exists(select 1 from public.dm_conversation_clears) then
    raise exception 'BUG: cleared state visible to the other participant';
  end if;
end $$;

-- Anonymous JWT must not be accepted by public authenticated submit RPC.
select set_config('request.jwt.claim.sub','',false);
select set_config('request.jwt.claim.session_id','',false);
do $$
begin
  begin
    perform public.xoxo_submit_conversation_report_beta(
      '11111111-1111-4111-8111-111111111111',3,'No JWT subject',
      array['77777777-7777-4777-8777-777777777771'::uuid],
      '88888888-8888-4888-8888-000000000013'
    );
    raise exception 'BUG: missing JWT subject accepted';
  exception when sqlstate '28000' then null; end;
end $$;

-- Capture a *real* report ID as the local CI superuser. Neither ordinary
-- members nor admins without a valid PIN may change this persisted row.
reset role;
select set_config('xoxo.safety_ci_report_id',
  (select id::text from xoxo_safety_private.conversation_reports
   order by created_at limit 1),false);
set role authenticated;

-- Admin report queue MUST block a normal user.
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
select set_config('request.jwt.claim.session_id','aaaaaaaa-0000-4000-8000-000000000001',false);
do $$
begin
  begin
    perform public.xoxo_admin_list_conversation_reports_beta('Reviewing safety report evidence');
    raise exception 'BUG: non-admin obtained private report queue';
  exception when sqlstate '42501' then null; end;
  begin
    perform public.xoxo_admin_update_conversation_report_beta(
      current_setting('xoxo.safety_ci_report_id')::uuid,
      'dismissed','Unrelated user may not update a report');
    raise exception 'BUG: unrelated user updated another member report';
  exception when sqlstate '42501' then null; end;
end $$;

-- Even admin accounts without a valid PIN MUST be denied.
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
select set_config('request.jwt.claim.session_id','cccccccc-0000-4000-8000-000000000003',false);
do $$
begin
  begin
    perform public.xoxo_admin_list_conversation_reports_beta('Reviewing safety report evidence');
    raise exception 'BUG: expired PIN allowed report queue';
  exception when sqlstate '42501' then null; end;
  begin
    perform public.xoxo_admin_update_conversation_report_beta(
      current_setting('xoxo.safety_ci_report_id')::uuid,
      'dismissed','Reviewing report with an expired PIN');
    raise exception 'BUG: expired PIN changed report status';
  exception when sqlstate '42501' then null; end;
end $$;

-- A time-valid but LOCKED PIN must prevent both list and status update.
reset role;
update public.xoxo_moderation_pin_security
   set verified_until=now()+interval '5 minutes',
       locked_until=now()+interval '5 minutes'
 where admin_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set role authenticated;
do $$
begin
  begin
    perform public.xoxo_admin_list_conversation_reports_beta('Checking a PIN locked report');
    raise exception 'BUG: locked PIN exposed the report queue';
  exception when sqlstate '42501' then null; end;
  begin
    perform public.xoxo_admin_update_conversation_report_beta(
      current_setting('xoxo.safety_ci_report_id')::uuid,
      'dismissed','Checking a PIN locked status action');
    raise exception 'BUG: locked PIN changed a report status';
  exception when sqlstate '42501' then null; end;
end $$;

-- Neither a normal user, expired PIN nor locked PIN may leave a changed row
-- or moderation status audit event in the disposable database.
reset role;
do $$
begin
  if (select status from xoxo_safety_private.conversation_reports
      where id=current_setting('xoxo.safety_ci_report_id')::uuid) <> 'pending' then
    raise exception 'BUG: forbidden role/PIN status update modified report';
  end if;
  if exists(select 1 from public.xoxo_message_access_log
            where action like 'conversation_report_status:%') then
    raise exception 'BUG: denied status update produced an audit side effect';
  end if;
end $$;

-- Set up a verified admin PIN only in the temporary test database.
reset role;
update public.xoxo_moderation_pin_security set verified_until=now()+interval '5 minutes', locked_until=null
 where admin_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
select set_config('request.jwt.claim.session_id','cccccccc-0000-4000-8000-000000000003',false);
do $$
declare
  v_queue jsonb;
  v_report uuid;
begin
  v_queue := public.xoxo_admin_list_conversation_reports_beta('Reviewing safety report evidence');
  if jsonb_typeof(v_queue) <> 'array' or jsonb_array_length(v_queue) <> 10 then
    raise exception 'BUG: expected 10 saved, PIN-authorized reports, got %',v_queue;
  end if;
  v_report := (v_queue->0->>'id')::uuid;
  -- A valid PIN does not eliminate the existing mandatory moderation reason.
  begin
    perform public.xoxo_admin_list_conversation_reports_beta('short');
    raise exception 'BUG: report queue accepted a missing/short reason';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.xoxo_admin_update_conversation_report_beta(v_report,'reviewed','short');
    raise exception 'BUG: status change accepted a missing/short reason';
  exception when sqlstate '22023' then null; end;
  if not public.xoxo_admin_update_conversation_report_beta(v_report,'reviewed','Reviewed evidence from reported conversation') then
    raise exception 'BUG: admin status change not saved';
  end if;
  begin
    perform public.xoxo_admin_update_conversation_report_beta(v_report,'unknown','Reviewed evidence from reported conversation');
    raise exception 'BUG: invalid status accepted';
  exception when sqlstate '22023' then null; end;
end $$;

reset role;
do $$
begin
  if (select count(*) from xoxo_safety_private.conversation_reports) <> 10 then
    raise exception 'BUG: duplicate, invalid or rate-limited reports were persisted';
  end if;
  if (select count(*) from xoxo_safety_private.conversation_report_evidence) <> 11 then
    raise exception 'BUG: evidence rows not persisted atomically';
  end if;
  if (select count(*) from public.xoxo_message_access_log
      where action like 'conversation_report_status:reviewed:%') <> 1 then
    raise exception 'BUG: status update has no moderation audit record';
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema='xoxo_safety_private'
      and table_name='conversation_report_evidence'
      and column_name in ('content','attachment_path','attachment_name')
  ) then
    raise exception 'BUG: unreviewed message/media snapshots in evidence schema';
  end if;
end $$;

-- The report metadata survives physical message deletion (there is no FK).
delete from public.direct_messages
 where id='77777777-7777-4777-8777-777777777771';
do $$
begin
  if (select count(*) from xoxo_safety_private.conversation_reports) <> 10 then
    raise exception 'BUG: a deleted DM removed conversation reports';
  end if;
  if (select count(*) from xoxo_safety_private.conversation_report_evidence
      where message_id='77777777-7777-4777-8777-777777777771') <> 2 then
    raise exception 'BUG: deletion removed selected evidence metadata';
  end if;
end $$;

\echo 'PASS: 17 isolated PostgreSQL security/integration cases (no production access)'
