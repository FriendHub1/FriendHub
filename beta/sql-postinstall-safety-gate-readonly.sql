-- XOXO Avenue / Stay Safe, Sweetheart! — post-install BETA security gate.
-- READ-ONLY: run just after installation, BEFORE adding any test accounts.
-- Expected result: one row with ready_for_restricted_beta = true.
-- Does not read messages, users, private report bodies or session secrets.
with required_private_tables(name) as (
  values ('report_beta_testers'),
         ('conversation_reports'),
         ('conversation_report_evidence')
), private_table_checks as (
  select t.name,
    c.oid is not null
      and c.relrowsecurity
      and not pg_catalog.has_schema_privilege('anon','xoxo_safety_private','USAGE')
      and not pg_catalog.has_schema_privilege('authenticated','xoxo_safety_private','USAGE')
      and not pg_catalog.has_table_privilege('anon',c.oid,'SELECT')
      and not pg_catalog.has_table_privilege('authenticated',c.oid,'SELECT')
      and not pg_catalog.has_table_privilege('authenticated',c.oid,'INSERT')
      and not exists (
        select 1 from pg_catalog.pg_policy pol where pol.polrelid=c.oid
      ) as passed
  from required_private_tables t
  left join pg_catalog.pg_class c
    on c.oid=pg_catalog.to_regclass('xoxo_safety_private.' || t.name)
), required_rpcs(signature) as (
  values
    ('public.xoxo_submit_conversation_report_beta(uuid,integer,text,uuid[],uuid)'),
    ('public.xoxo_admin_list_conversation_reports_beta(text)'),
    ('public.xoxo_admin_update_conversation_report_beta(uuid,text,text)'),
    ('public.xoxo_admin_page_conversation_reports_beta(text,boolean,timestamptz,uuid,integer)')
), rpc_checks as (
  select r.signature,
    p.oid is not null
      and p.prosecdef
      and 'search_path=""'=any(p.proconfig)
      and pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE')
      and not pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE')
      as passed
  from required_rpcs r
  left join pg_catalog.pg_proc p
    on p.oid=pg_catalog.to_regprocedure(r.signature)
), helper_checks as (
  select p.oid is not null
      and not p.prosecdef
      and 'search_path=""'=any(p.proconfig)
      and not pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE')
      and not pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE')
      as passed
    from (select pg_catalog.to_regprocedure(
      'xoxo_safety_private.active_session_for(uuid)') as oid) helper
    left join pg_catalog.pg_proc p on p.oid=helper.oid
), gate_checks as (
  select
    pg_catalog.to_regclass('xoxo_safety_private.report_beta_testers') is not null
      and (select count(*) from xoxo_safety_private.report_beta_testers)=0
      and (select count(*) from xoxo_safety_private.conversation_reports)=0
      and (select count(*) from xoxo_safety_private.conversation_report_evidence)=0
      and exists (
        select 1 from pg_catalog.pg_proc p
        where p.oid=pg_catalog.to_regprocedure(
          'public.xoxo_submit_conversation_report_beta(uuid,integer,text,uuid[],uuid)')
          and pg_catalog.pg_get_functiondef(p.oid) like '%report_beta_testers%'
          and pg_catalog.pg_get_functiondef(p.oid) like '%tester.expires_at > now()%'
      ) as passed
)
select
  (select pg_catalog.bool_and(passed) from private_table_checks)
  and (select pg_catalog.bool_and(passed) from rpc_checks)
  and (select pg_catalog.bool_and(passed) from helper_checks)
  and (select passed from gate_checks)
  as ready_for_restricted_beta;
