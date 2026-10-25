-- XOXO Avenue BETA: transactional submission RPC proposal.
-- REVIEW ONLY: DO NOT EXECUTE ON LIVE SUPABASE WITHOUT APPROVAL.
-- Requires beta/proposed-conversation-reports-schema.sql to be reviewed first.
--
-- Security model:
-- - derive reporter solely from auth.uid()
-- - validate peer and every selected message server-side
-- - reproduce the existing direct_messages SELECT clearance rule explicitly,
--   because SECURITY DEFINER bypasses ordinary RLS
-- - refuse whisper/once-view media evidence pending a retention policy
-- - report and evidence insert atomically in one RPC transaction
-- - idempotency lock and daily rate limit, without client-supplied author IDs
-- - no snapshot of private message content and no browser table privileges
--
-- Review this SECURITY DEFINER function and run RLS/security advisors before
-- deployment. The cap (20 per 24 hours) is a proposal, not an approved policy.

create or replace function public.xoxo_submit_conversation_report_beta(
  p_other_user_id uuid,
  p_reason_code smallint,
  p_details text,
  p_message_ids uuid[],
  p_idempotency_key uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reporter uuid := (select auth.uid());
  v_details text := coalesce(p_details, '');
  v_requested uuid[];
  v_existing_ids uuid[];
  v_count integer;
  v_report_id uuid;
  v_existing public.xoxo_conversation_reports_beta%rowtype;
begin
  if v_reporter is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_other_user_id is null or p_other_user_id = v_reporter or
     p_reason_code is null or p_reason_code not between 0 and 5 or
     p_idempotency_key is null or char_length(v_details)>2000 or
     p_message_ids is null or cardinality(p_message_ids) not between 1 and 20 or
     array_position(p_message_ids,null) is not null then
    raise exception 'Invalid report request' using errcode = '22023';
  end if;

  select array_agg(x.message_id order by x.message_id)
  into v_requested
  from unnest(p_message_ids) as x(message_id);
  select count(distinct x.message_id)
  into v_count
  from unnest(p_message_ids) as x(message_id);
  if v_count <> cardinality(p_message_ids) then
    raise exception 'Duplicate evidence message' using errcode = '22023';
  end if;

  -- Serialize requests for a reporter, including rate-limit checks and retries.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_reporter::text,4242::bigint)
  );

  select r.* into v_existing
  from public.xoxo_conversation_reports_beta r
  where r.reporter_id = v_reporter and r.idempotency_key = p_idempotency_key;
  if v_existing.id is not null then
    select array_agg(e.selected_message_id order by e.selected_message_id)
    into v_existing_ids
    from public.xoxo_conversation_report_evidence_beta e
    where e.report_id = v_existing.id;
    if v_existing.other_user_id is distinct from p_other_user_id or
       v_existing.reason_code is distinct from p_reason_code or
       v_existing.details is distinct from v_details or
       v_existing_ids is distinct from v_requested then
      raise exception 'Idempotency key already used for another request'
        using errcode = '22023';
    end if;
    return v_existing.id;
  end if;

  select count(*) into v_count
  from public.xoxo_conversation_reports_beta r
  where r.reporter_id = v_reporter
    and r.created_at > pg_catalog.now()-interval '24 hours';
  if v_count >= 20 then
    raise exception 'Too many reports in this period' using errcode = 'P0001';
  end if;

  -- Match the current direct_messages RLS pair / cleared-history semantics.
  -- Definer privileges MUST NOT permit evidence from third-party conversations.
  -- Exclude all whispers and non-normal media until their retention rules are
  -- explicitly approved; this does not capture attachment content.
  select count(*) into v_count
  from public.direct_messages dm
  where dm.id = any(p_message_ids)
    and (
      (dm.sender_id = v_reporter and dm.recipient_id = p_other_user_id)
      or (dm.sender_id = p_other_user_id and dm.recipient_id = v_reporter)
    )
    and dm.whisper_id is null
    and coalesce(dm.media_view_mode,'normal') = 'normal'
    and not exists (
      select 1
      from public.dm_conversation_clears dc
      where dc.user_id = v_reporter
        and dc.other_user_id = p_other_user_id
        and dm.created_at <= dc.cleared_at
    );

  if v_count <> cardinality(p_message_ids) then
    raise exception 'Selected evidence unavailable or inaccessible'
      using errcode = '42501';
  end if;

  insert into public.xoxo_conversation_reports_beta
    (reporter_id,other_user_id,idempotency_key,reason_code,details)
  values
    (v_reporter,p_other_user_id,p_idempotency_key,p_reason_code,v_details)
  returning id into v_report_id;

  insert into public.xoxo_conversation_report_evidence_beta
    (report_id,selected_message_id,message_id)
  select v_report_id,x.message_id,x.message_id
  from unnest(p_message_ids) as x(message_id);

  return v_report_id;
end;
$$;

revoke all on function public.xoxo_submit_conversation_report_beta(
  uuid,smallint,text,uuid[],uuid
) from public, anon;
grant execute on function public.xoxo_submit_conversation_report_beta(
  uuid,smallint,text,uuid[],uuid
) to authenticated;

-- Verify with real authenticated/unauthorized accounts before enabling:
-- no user/peer spoofing, 0/21/duplicate/foreign/cleared/expired messages,
-- concurrent retries, reused keys, account deletion, and deleted DMs.
