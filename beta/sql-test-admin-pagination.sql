-- XOXO Avenue / disposable PostgreSQL keyset admin pagination regression.
-- Execute AFTER sql-test-admin-queue-priority.sql on xoxo_safety_test ONLY.
\set ON_ERROR_STOP on

do $local_guard$
begin
  if current_database()<>'xoxo_safety_test' then
    raise exception 'NEVER run BETA pagination fixtures on production';
  end if;
end $local_guard$;

reset role;
-- 132 more open cases, with identical timestamps for 20 of them, so a
-- cursor using only created_at would skip or duplicate real case IDs.
insert into xoxo_safety_private.conversation_reports
 (reporter_id,other_user_id,reason_code,details,message_ids,
  idempotency_key,status,created_at)
select
 '11111111-1111-4111-8111-111111111111'::uuid,
 '22222222-2222-4222-8222-222222222222'::uuid,
 1,'pagination_pending_case_'||n,
 array['77777777-7777-4777-8777-777777777773'::uuid],
 gen_random_uuid(),'pending',
 case when n<=20 then '2026-01-15T12:00:00Z'::timestamptz
      else '2026-02-01T12:00:00Z'::timestamptz+n*interval '1 minute'
 end
from generate_series(1,132) n;

select set_config('xoxo.safety_expected_pages_total',
  (select count(*)::text from xoxo_safety_private.conversation_reports),
  false);

set role authenticated;
select set_config('request.jwt.claim.sub',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
select set_config('request.jwt.claim.session_id',
 'cccccccc-0000-4000-8000-000000000003',false);

do $pagination_contract$
declare
 v_first jsonb;
 v_batch jsonb;
 v_items jsonb;
 v_cursor jsonb;
 v_last jsonb;
 v_case jsonb;
 v_seen uuid[]:=array[]::uuid[];
 v_count int:=0;
 v_pages int:=0;
 v_prior_pending boolean:=null;
 v_prior_created timestamptz:=null;
 v_prior_id uuid:=null;
 v_next_pending boolean;
 v_next_created timestamptz;
 v_next_id uuid;
 v_has_more boolean;
 v_expected int:=current_setting('xoxo.safety_expected_pages_total')::int;
begin
 -- Page 1 keeps the existing admin RPC and its 100-item return shape.
 v_first:=public.xoxo_admin_list_conversation_reports_beta(
   'Reviewing all pending cases with cursor pagination');
 if pg_catalog.jsonb_array_length(v_first)<>100 then
   raise exception 'BUG: initial PIN-gated queue must return 100 cases';
 end if;
 v_items:=v_first;

 for v_pages in 1..25 loop
   for v_case in select value from jsonb_array_elements(v_items) as t(value) loop
     if (v_case->>'id')::uuid=any(v_seen) then
       raise exception 'BUG: duplicate report ID across pages';
     end if;
     v_seen:=v_seen || (v_case->>'id')::uuid;
     v_count:=v_count+1;
     v_next_pending=(v_case->>'status'='pending');
     v_next_created=(v_case->>'created_at')::timestamptz;
     v_next_id=(v_case->>'id')::uuid;
     if v_prior_id is not null and not (
        (v_prior_pending,v_prior_created,v_prior_id)>
        (v_next_pending,v_next_created,v_next_id)) then
       raise exception 'BUG: priority/time/UUID order crossed a page boundary';
     end if;
     v_prior_pending=v_next_pending;
     v_prior_created=v_next_created;
     v_prior_id=v_next_id;
   end loop;

   if v_pages=1 then
     v_last:=v_first -> (pg_catalog.jsonb_array_length(v_first)-1);
     v_cursor:=jsonb_build_object('pending',v_last->>'status'='pending',
       'created_at',v_last->>'created_at','id',v_last->>'id');
   else
     if not v_has_more then exit;end if;
     v_cursor:=v_batch->'next_cursor';
   end if;

   v_batch:=public.xoxo_admin_page_conversation_reports_beta(
      'Reviewing all pending cases with cursor pagination',
      (v_cursor->>'pending')::boolean,
      (v_cursor->>'created_at')::timestamptz,
      (v_cursor->>'id')::uuid,25
   );
   if pg_catalog.jsonb_typeof(v_batch)<>'object' or
      pg_catalog.jsonb_typeof(v_batch->'reports')<>'array' or
      pg_catalog.jsonb_typeof(v_batch->'has_more')<>'boolean' then
     raise exception 'BUG: malformed secure pagination response';
   end if;
   v_has_more=(v_batch->>'has_more')::boolean;
   v_items:=v_batch->'reports';
   if pg_catalog.jsonb_array_length(v_items)>25 then
     raise exception 'BUG: a page returned more than requested 25';
   end if;
   if v_has_more and pg_catalog.jsonb_typeof(v_batch->'next_cursor')<>'object' then
     raise exception 'BUG: more reports exist but page cursor is missing';
   end if;
   if not v_has_more and v_batch->'next_cursor'<>'null'::jsonb then
     raise exception 'BUG: finished queue still returned a cursor';
   end if;
 end loop;
 if v_has_more then raise exception 'BUG: pagination did not terminate'; end if;
 if v_count<>v_expected then
   raise exception 'BUG: report list lost records: got %, expected %',
     v_count,v_expected;
 end if;
 if v_count<=200 or v_pages<=2 then
   raise exception 'BUG: pagination fixtures did not exceed 200 rows';
 end if;
end $pagination_contract$;

-- No invalid cursor/request may be interpreted as an authorized page.
do $page_rejections$
begin
  begin
    perform public.xoxo_admin_page_conversation_reports_beta(
      'Reviewing reports for invalid pagination test',null,null,
      '77777777-7777-4777-8777-777777777771'::uuid,25);
    raise exception 'BUG: partial cursor was accepted';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.xoxo_admin_page_conversation_reports_beta(
      'Reviewing reports for invalid pagination test',null,null,null,51);
    raise exception 'BUG: oversized page accepted';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.xoxo_admin_page_conversation_reports_beta(
      'Reviewing reports for invalid pagination test',null,null,null,0);
    raise exception 'BUG: zero-sized page accepted';
  exception when sqlstate '22023' then null; end;
end $page_rejections$;

-- A valid admin identity with an expired PIN is STILL unauthorized to
-- retrieve page 2, even when using a known legitimate cursor.
reset role;
update public.xoxo_moderation_pin_security
set verified_until=now()-interval '1 minute'
where admin_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid;
set role authenticated;

do $page_pin_expiry$
begin
  begin
    perform public.xoxo_admin_page_conversation_reports_beta(
      'Checking report page with expired moderation PIN',
      null,null,null,25);
    raise exception 'BUG: expired PIN read page metadata';
  exception when sqlstate '42501' then null; end;
end $page_pin_expiry$;

reset role;
do $verify_access_events$
declare v_actual int;v_expected int;
begin
  select count(*) into v_actual
    from public.xoxo_message_access_log
    where action like 'conversation_report_page:view count=%';
  select count(*) into v_expected from (
    select 1 from public.xoxo_message_access_log
    where action like 'conversation_report_page:view count=%'
    and admin_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid
  ) a;
  if v_actual<>v_expected or v_actual<2 then
    raise exception 'BUG: page read was not audited or denial was incorrectly audited';
  end if;
end $verify_access_events$;

\echo 'PASS: cursor pagination includes all >200 private reports, preserves pending priority/UUID ties, and requires PIN for every page'
