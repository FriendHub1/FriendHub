-- XOXO Avenue / BETA-only >100 report queue ordering regression.
-- Must run ONLY against the disposable PostgreSQL CI database, after HTTP tests.
\set ON_ERROR_STOP on
do $queue_guard$
begin
  if current_database() <> 'xoxo_safety_test' then
    raise exception 'Refusing to run priority test outside disposable CI database';
  end if;
end $queue_guard$;

reset role;
-- Flood the test queue with 120 RECENT closed cases and three very OLD
-- still-pending cases. All synthetic: no private message text or real accounts.
insert into xoxo_safety_private.conversation_reports
  (reporter_id,other_user_id,reason_code,details,message_ids,
   idempotency_key,status,created_at)
select
 '11111111-1111-4111-8111-111111111111'::uuid,
 '22222222-2222-4222-8222-222222222222'::uuid,
 1,'priority_closed_'||i,
 array['77777777-7777-4777-8777-777777777773'::uuid],
 gen_random_uuid(),'resolved',
 now()-(121-i)*interval '1 minute'
from generate_series(1,120) i;

insert into xoxo_safety_private.conversation_reports
  (reporter_id,other_user_id,reason_code,details,message_ids,
   idempotency_key,status,created_at)
select
 '11111111-1111-4111-8111-111111111111'::uuid,
 '22222222-2222-4222-8222-222222222222'::uuid,
 1,'queue_priority_old_pending_'||i,
 array['77777777-7777-4777-8777-777777777773'::uuid],
 gen_random_uuid(),'pending',
 now()-interval '95 days'-(4-i)*interval '1 day'
from generate_series(1,3) i;

-- The HTTP test ended with the test admin PIN intentionally locked.
-- Reauthorize this synthetic admin *only* in the temporary CI database.
update public.xoxo_moderation_pin_security
set verified_until=now()+interval '5 minutes',locked_until=null
where admin_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid;

set role authenticated;
select set_config('request.jwt.claim.sub',
 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
select set_config('request.jwt.claim.session_id',
 'cccccccc-0000-4000-8000-000000000003',false);

do $queue_priority_test$
declare
  q jsonb;
  pending_last integer;
  closed_first integer;
  old_count integer;
begin
  q := public.xoxo_admin_list_conversation_reports_beta(
    'Reviewing unresolved cases before closed cases');
  if jsonb_typeof(q) <> 'array' or jsonb_array_length(q) <> 100 then
    raise exception 'BUG: admin report queue must return exactly 100 metadata cards';
  end if;

  select count(*) into old_count from jsonb_array_elements(q) item
   where item->>'details' like 'queue_priority_old_pending_%';
  if old_count <> 3 then
    raise exception 'BUG: old pending reports were crowded out by newer closed cases: %',old_count;
  end if;

  select max(n) into pending_last from jsonb_array_elements(q)
    with ordinality as entries(item,n)
    where item->>'status'='pending';
  select min(n) into closed_first from jsonb_array_elements(q)
    with ordinality as entries(item,n)
    where item->>'status'<>'pending';
  if pending_last is null or closed_first is null or pending_last >= closed_first then
    raise exception 'BUG: a closed case appeared before an unresolved report';
  end if;

  -- No message body or attachment path must be present in queue metadata.
  if exists(select 1 from jsonb_array_elements(q) as item
            where item ? 'content' or item ? 'attachment_path') then
    raise exception 'BUG: admin metadata queue exposed message contents';
  end if;
end $queue_priority_test$;

reset role;
do $queue_audit_check$
begin
  if (select count(*) from public.xoxo_message_access_log
      where admin_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid
        and action like 'conversation_report_queue:view count=100:%') <> 1 then
    raise exception 'BUG: 100-case prioritized queue read was not audited exactly once';
  end if;
end $queue_audit_check$;

\echo 'PASS: prioritized admin queue retains three 95-day-old pending reports among 120 newer closed cases; 100 cap + audit'
