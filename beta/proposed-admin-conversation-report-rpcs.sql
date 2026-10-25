-- XOXO Avenue BETA: admin report metadata RPCs.
-- REVIEW ONLY. DO NOT EXECUTE ON LIVE SUPABASE WITHOUT USER APPROVAL.
-- Depends on beta/proposed-conversation-reports-schema.sql.
-- Mirrors verified live admin reporting pattern: public.is_xoxo_admin().
-- Returns NO message content. Full DM history remains controlled by
-- xoxo_admin_read_dm_page_pin (existing audited PIN-gated RPC).

create or replace function public.xoxo_admin_list_conversation_reports_beta()
returns table (
  id uuid,
  reporter_id uuid,
  other_user_id uuid,
  reason_code smallint,
  details text,
  status text,
  created_at timestamptz,
  evidence_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not public.is_xoxo_admin() then
    raise exception 'Access denied: administrator required'
      using errcode = '42501';
  end if;

  return query
    select
      r.id, r.reporter_id, r.other_user_id, r.reason_code,
      r.details, r.status, r.created_at,
      (
        select count(*)::integer
        from public.xoxo_conversation_report_evidence_beta e
        where e.report_id = r.id
      ) as evidence_count
    from public.xoxo_conversation_reports_beta r
    order by r.created_at desc
    limit 100;
end;
$$;

revoke all on function public.xoxo_admin_list_conversation_reports_beta()
  from public, anon;
grant execute on function public.xoxo_admin_list_conversation_reports_beta()
  to authenticated;

create or replace function public.xoxo_admin_update_conversation_report_status_beta(
  p_report_id uuid,
  p_status text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated boolean;
begin
  if (select auth.uid()) is null or not public.is_xoxo_admin() then
    raise exception 'Access denied: administrator required'
      using errcode = '42501';
  end if;

  if p_status is null or p_status not in
    ('pending','reviewed','resolved','dismissed') then
    raise exception 'Invalid report status' using errcode = '22023';
  end if;

  update public.xoxo_conversation_reports_beta
  set status = p_status
  where id = p_report_id;

  v_updated := found;
  return v_updated;
end;
$$;

revoke all on function public.xoxo_admin_update_conversation_report_status_beta(uuid,text)
  from public, anon;
grant execute on function public.xoxo_admin_update_conversation_report_status_beta(uuid,text)
  to authenticated;

-- IMPORTANT: Both functions are server-authorized. No browser client is
-- trusted for admin status. Run security advisor and permission/RLS tests
-- before deployment. Do not replace existing get_xoxo_dm_reports functions.
