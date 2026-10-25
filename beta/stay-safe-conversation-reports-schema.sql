-- XOXO Avenue / Stay Safe, Sweetheart! — BETA ONLY
-- REVIEW-ONLY SQL. DO NOT APPLY TO THE LIVE DATABASE WITHOUT OWNER APPROVAL.
-- Designed against project cxosofpxfmjkrhfabrqc (schema inspected 2026-10-25).
-- Purpose: atomic conversation reports with 1–20 explicitly selected DM IDs.
-- Existing public.direct_message_reports and PIN-protected DM viewer are untouched.
-- Retention: store IDs + minimal metadata, NOT copies of DM content/attachments.
-- Applying requires a separate privacy/retention review and real-account tests.

begin;

create schema if not exists xoxo_safety_private;
revoke all on schema xoxo_safety_private from public, anon, authenticated;

create table if not exists xoxo_safety_private.conversation_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null,
  other_user_id uuid not null,
  reason_code integer not null check (reason_code between 0 and 5),
  details text not null default '' check (char_length(details) <= 2000),
  message_ids uuid[] not null check (cardinality(message_ids) between 1 and 20),
  idempotency_key uuid not null,
  status text not null default 'pending'
    check (status in ('pending','reviewed','resolved','dismissed')),
  created_at timestamptz not null default now(),
  unique (reporter_id, idempotency_key),
  check (reporter_id <> other_user_id)
);

create index if not exists xoxo_conversation_reports_queue_beta
  on xoxo_safety_private.conversation_reports(status, created_at desc);

create index if not exists xoxo_conversation_reports_rate_beta
  on xoxo_safety_private.conversation_reports(reporter_id, created_at desc);

create table if not exists xoxo_safety_private.conversation_report_evidence (
  report_id uuid not null references xoxo_safety_private.conversation_reports(id) on delete cascade,
  ordinal smallint not null check (ordinal between 1 and 20),
  message_id uuid not null,
  sender_id uuid not null,
  recipient_id uuid not null,
  message_created_at timestamptz not null,
  primary key (report_id, message_id),
  unique (report_id, ordinal)
);

-- No FK to direct_messages: preserves report IDs if a DM is deleted.
-- Never expose private tables through PostgREST or grant user SELECT/INSERT.
alter table xoxo_safety_private.conversation_reports enable row level security;
alter table xoxo_safety_private.conversation_report_evidence enable row level security;
revoke all on all tables in schema xoxo_safety_private from public, anon, authenticated;
revoke all on schema xoxo_safety_private from public, anon, authenticated;

create or replace function public.xoxo_submit_conversation_report_beta(
  p_other_user_id uuid,
  p_reason_code integer,
  p_details text,
  p_message_ids uuid[],
  p_idempotency_key uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $xoxo$
declare
  v_reporter uuid := auth.uid();
  v_normalized_ids uuid[];
  v_distinct_count integer;
  v_existing xoxo_safety_private.conversation_reports%rowtype;
  v_report_id uuid;
  v_message record;
  v_found integer := 0;
begin
  -- SECURITY DEFINER is intentional: the private tables are not user-readable.
  -- This RPC accepts only authenticated user JWTs and explicitly reauthorizes
  -- every message; it must be audited before enabling in production.
  if v_reporter is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if p_other_user_id is null or p_other_user_id = v_reporter
     or p_reason_code is null or p_reason_code not between 0 and 5
     or p_details is null or char_length(p_details) > 2000
     or p_idempotency_key is null
     or p_message_ids is null
     or cardinality(p_message_ids) not between 1 and 20 then
    raise exception 'Invalid report parameters' using errcode = '22023';
  end if;
  if exists(select 1 from unnest(p_message_ids) as x(id) where x.id is null) then
    raise exception 'Null message IDs are not allowed' using errcode = '22023';
  end if;

  select count(distinct x.id), array_agg(x.id order by x.id)
    into v_distinct_count, v_normalized_ids
    from unnest(p_message_ids) as x(id);
  if v_distinct_count <> cardinality(p_message_ids) then
    raise exception 'Duplicate message IDs are not allowed' using errcode = '22023';
  end if;

  -- Serialize submissions by reporter to make 24h rate limits reliable
  -- under simultaneous requests and repeated idempotency keys.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('xoxo_safety_report:' || v_reporter::text, 0)
  );

  select * into v_existing
    from xoxo_safety_private.conversation_reports r
    where r.reporter_id = v_reporter
      and r.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.other_user_id <> p_other_user_id
       or v_existing.reason_code <> p_reason_code
       or v_existing.details <> p_details
       or v_existing.message_ids <> v_normalized_ids then
      raise exception 'Idempotency key reused for a different report'
        using errcode = '22023';
    end if;
    return v_existing.id;
  end if;

  if (select count(*)
      from xoxo_safety_private.conversation_reports r
      where r.reporter_id = v_reporter
        and r.created_at > now() - interval '24 hours') >= 10 then
    raise exception 'Daily report limit reached' using errcode = 'P0001';
  end if;

  -- The owner of this definer RPC bypasses RLS. Replicate the existing
  -- direct_messages SELECT policy explicitly, including per-user clears.
  -- FOR KEY SHARE prevents deletion of validated DMs until commit.
  for v_message in
    select dm.id, dm.sender_id, dm.recipient_id, dm.created_at
      from public.direct_messages dm
      where dm.id = any(v_normalized_ids)
      for key share
  loop
    if not (
      (v_message.sender_id = v_reporter and v_message.recipient_id = p_other_user_id)
      or (v_message.sender_id = p_other_user_id and v_message.recipient_id = v_reporter)
    ) then
      raise exception 'Evidence does not belong to this conversation'
        using errcode = '42501';
    end if;

    if exists (
      select 1 from public.dm_conversation_clears dc
       where dc.user_id = v_reporter
         and dc.other_user_id = p_other_user_id
         and v_message.created_at <= dc.cleared_at
    ) then
      raise exception 'Evidence is not visible to reporter'
        using errcode = '42501';
    end if;
    v_found := v_found + 1;
  end loop;

  if v_found <> cardinality(v_normalized_ids) then
    raise exception 'Evidence missing or inaccessible' using errcode = '42501';
  end if;

  insert into xoxo_safety_private.conversation_reports
    (reporter_id, other_user_id, reason_code, details, message_ids, idempotency_key)
  values
    (v_reporter, p_other_user_id, p_reason_code, p_details,
     v_normalized_ids, p_idempotency_key)
  returning id into v_report_id;

  insert into xoxo_safety_private.conversation_report_evidence
    (report_id, ordinal, message_id, sender_id, recipient_id, message_created_at)
  select v_report_id, selected.ordinal::smallint, dm.id, dm.sender_id,
         dm.recipient_id, dm.created_at
    from unnest(v_normalized_ids) with ordinality as selected(id, ordinal)
    join public.direct_messages dm on dm.id = selected.id;

  if (select count(*) from xoxo_safety_private.conversation_report_evidence
       where report_id = v_report_id) <> cardinality(v_normalized_ids) then
    raise exception 'Evidence could not be saved atomically' using errcode = 'P0001';
  end if;
  return v_report_id;
end
$xoxo$;

-- Never leave SECURITY DEFINER executable by PUBLIC/anon.
revoke all on function public.xoxo_submit_conversation_report_beta(
  uuid, integer, text, uuid[], uuid
) from public, anon, authenticated;
grant execute on function public.xoxo_submit_conversation_report_beta(
  uuid, integer, text, uuid[], uuid
) to authenticated;

comment on function public.xoxo_submit_conversation_report_beta(
  uuid, integer, text, uuid[], uuid
) is 'BETA conversation-report submission. Authenticated JWT required; server validates 1-20 visible messages and stores metadata atomically.';


-- Read-only metadata for the EXISTING admin moderation panel.
-- The frontend must keep its current PIN prompt and DM viewer; this is not
-- a second conversation viewer and never returns message contents.
create or replace function public.xoxo_admin_list_conversation_reports_beta(
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $xoxo_admin_list$
declare
  v_rows jsonb;
  v_reason text := pg_catalog.btrim(pg_catalog.coalesce(p_reason,''));
begin
  if auth.uid() is null or not public.is_xoxo_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.xoxo_moderation_pin_security ps
     where ps.admin_id = auth.uid()
       and ps.verified_until > now()
       and (ps.locked_until is null or ps.locked_until <= now())
  ) then
    raise exception 'Moderation PIN verification required' using errcode = '42501';
  end if;
  -- Same mandatory 10–300 character moderation reason as the existing
  -- PIN-gated full conversation viewer.
  if pg_catalog.length(v_reason) not between 10 and 300 then
    raise exception 'A moderation reason of 10 to 300 characters is required'
      using errcode = '22023';
  end if;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]'::jsonb)
    into v_rows
  from (
    select r.id, r.reporter_id, r.other_user_id as reported_user_id,
           r.reason_code, r.details, r.message_ids, r.status, r.created_at
      from xoxo_safety_private.conversation_reports r
      order by r.created_at desc
      limit 100
  ) x;
  return v_rows;
end
$xoxo_admin_list$;

revoke all on function public.xoxo_admin_list_conversation_reports_beta(text)
  from public, anon, authenticated;
grant execute on function public.xoxo_admin_list_conversation_reports_beta(text)
  to authenticated;

-- Use this ONLY for status changes. It does not change any existing DM report.
-- Reuses the current PIN authorization and DM moderation audit log.
create or replace function public.xoxo_admin_update_conversation_report_beta(
  p_report_id uuid,
  p_status text,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $xoxo_admin_status$
declare
  v_reporter uuid;
  v_other_user uuid;
  v_reason text := pg_catalog.btrim(pg_catalog.coalesce(p_reason,''));
begin
  if auth.uid() is null or not public.is_xoxo_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.xoxo_moderation_pin_security ps
     where ps.admin_id = auth.uid()
       and ps.verified_until > now()
       and (ps.locked_until is null or ps.locked_until <= now())
  ) then
    raise exception 'Moderation PIN verification required' using errcode = '42501';
  end if;
  if pg_catalog.length(v_reason) not between 10 and 300 then
    raise exception 'A moderation reason of 10 to 300 characters is required'
      using errcode = '22023';
  end if;
  if p_report_id is null or p_status is null
     or p_status not in ('pending','reviewed','resolved','dismissed') then
    raise exception 'Invalid report status' using errcode = '22023';
  end if;

  update xoxo_safety_private.conversation_reports r
     set status = p_status
   where r.id = p_report_id
   returning r.reporter_id, r.other_user_id
     into v_reporter, v_other_user;
  if not found then
    return false;
  end if;

  insert into public.xoxo_message_access_log
    (admin_id, conversation_user_1, conversation_user_2, action)
  values
    (auth.uid(), least(v_reporter, v_other_user),
     greatest(v_reporter, v_other_user),
     'conversation_report_status:' || p_status || ': ' || v_reason);
  return true;
end
$xoxo_admin_status$;

revoke all on function public.xoxo_admin_update_conversation_report_beta(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.xoxo_admin_update_conversation_report_beta(uuid, text, text)
  to authenticated;

commit;

-- NOT INCLUDED: frontend admin UI wiring or real-environment integration tests.
-- The draft admin RPCs return metadata only and preserve the PIN-gated viewer.
-- This file is NOT part of a deployed migration or production workflow.
