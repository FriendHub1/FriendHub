-- XOXO Avenue — Stay Safe, Sweetheart!
-- Production fix: allow any permanent, authenticated account to submit a
-- conversation report. The previous BETA tester allowlist blocked real users
-- even after the production UI was enabled.
-- Security remains enforced server-side: active non-anonymous Auth session,
-- explicit message ownership/visibility checks, 1–20 normal messages,
-- idempotency, atomic metadata/evidence write, and a 10-per-24h rate limit.
-- No message bodies or attachment contents are copied into the report.

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
  if v_reporter is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if not xoxo_safety_private.active_session_for(v_reporter) then
    raise exception 'Active authenticated session required' using errcode = '28000';
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

  for v_message in
    select dm.id, dm.sender_id, dm.recipient_id, dm.created_at,
           dm.whisper_id, dm.media_view_mode
      from public.direct_messages dm
      where dm.id = any(v_normalized_ids)
      for share
  loop
    if not (
      (v_message.sender_id = v_reporter and v_message.recipient_id = p_other_user_id)
      or (v_message.sender_id = p_other_user_id and v_message.recipient_id = v_reporter)
    ) then
      raise exception 'Evidence does not belong to this conversation'
        using errcode = '42501';
    end if;

    if v_message.whisper_id is not null or
       coalesce(v_message.media_view_mode, 'normal') <> 'normal' then
      raise exception 'Disappearing or once-view messages cannot be report evidence'
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
    raise exception 'Evidence missing or inaccessible'
      using errcode = '42501';
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

revoke all on function public.xoxo_submit_conversation_report_beta(
  uuid, integer, text, uuid[], uuid
) from public, anon, authenticated;
grant execute on function public.xoxo_submit_conversation_report_beta(
  uuid, integer, text, uuid[], uuid
) to authenticated;

comment on function public.xoxo_submit_conversation_report_beta(
  uuid, integer, text, uuid[], uuid
) is 'Production conversation-report submission. Requires an active authenticated non-anonymous session; validates 1–20 visible normal messages, rate-limits submissions, and stores report metadata/evidence atomically.';
