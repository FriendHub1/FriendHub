-- XOXO Avenue / Stay Safe, Sweetheart! -- BETA PREDEPLOYMENT GATE.
-- PURE READ-ONLY CATALOG QUERY. NO PERSONAL MESSAGES OR REPORTS ARE READ.
-- Checked against project cxosofpxfmjkrhfabrqc on 2026-10-25.
-- Run BEFORE any owner-approved SQL migration. BLOCK_RELEASE means stop and
-- re-audit dependencies; do not install the BETA RPC against a changed schema.
-- This complements sql-verify-existing-dm-rls-readonly.sql (policy fingerprints).

with required_columns(schema_name,table_name,column_name,udt_name,required_not_null) as (
  values
    ('auth','sessions','id','uuid',true),
    ('auth','sessions','user_id','uuid',true),
    ('auth','sessions','not_after','timestamptz',false),
    ('public','direct_messages','id','uuid',true),
    ('public','direct_messages','sender_id','uuid',true),
    ('public','direct_messages','recipient_id','uuid',true),
    ('public','direct_messages','created_at','timestamptz',true),
    ('public','dm_conversation_clears','user_id','uuid',true),
    ('public','dm_conversation_clears','other_user_id','uuid',true),
    ('public','dm_conversation_clears','cleared_at','timestamptz',true),
    ('public','xoxo_moderation_pin_security','admin_id','uuid',true),
    ('public','xoxo_moderation_pin_security','verified_until','timestamptz',false),
    ('public','xoxo_moderation_pin_security','locked_until','timestamptz',false),
    ('public','xoxo_message_access_log','id','uuid',true),
    ('public','xoxo_message_access_log','admin_id','uuid',true),
    ('public','xoxo_message_access_log','conversation_user_1','uuid',true),
    ('public','xoxo_message_access_log','conversation_user_2','uuid',true),
    ('public','xoxo_message_access_log','action','text',true)
), column_checks as (
  select 'column'::text as category,
    (r.schema_name||'.'||r.table_name||'.'||r.column_name)::text as object_name,
    (c.column_name is not null and c.udt_name=r.udt_name
      and (not r.required_not_null or c.is_nullable='NO')) as valid
  from required_columns r
  left join information_schema.columns c
    on c.table_schema=r.schema_name and c.table_name=r.table_name
   and c.column_name=r.column_name
), required_routines(signature,result_type,requires_definer) as (
  values
    ('auth.jwt()','jsonb',false),
    ('auth.uid()','uuid',false),
    ('public.is_xoxo_admin()','boolean',true),
    ('public.xoxo_moderation_pin_status()','jsonb',true),
    ('public.xoxo_moderation_pin_setup(text)','jsonb',true),
    ('public.xoxo_moderation_pin_verify(text)','jsonb',true),
    ('public.xoxo_admin_read_dm_page_pin(uuid,uuid,text,timestamptz,uuid)','jsonb',true),
    ('public.get_xoxo_dm_reports()',null::text,true),
    ('public.update_xoxo_dm_report_status(uuid,text)','boolean',true)
), routine_checks as (
  select 'routine'::text as category,r.signature::text as object_name,
    (p.oid is not null and p.prosecdef=r.requires_definer
      and (r.result_type is null or pg_catalog.pg_get_function_result(p.oid)=r.result_type)) as valid
  from required_routines r
  left join pg_catalog.pg_proc p
    on p.oid=pg_catalog.to_regprocedure(r.signature)
), structural_checks as (
  select 'structure'::text as category, v.object_name, v.valid
  from (
    values
      ('direct_messages RLS enabled',
        (select c.relrowsecurity from pg_catalog.pg_class c
         where c.oid=pg_catalog.to_regclass('public.direct_messages'))),
      ('dm_conversation_clears RLS enabled',
        (select c.relrowsecurity from pg_catalog.pg_class c
         where c.oid=pg_catalog.to_regclass('public.dm_conversation_clears'))),
      ('xoxo_moderation_pin_security RLS enabled',
        (select c.relrowsecurity from pg_catalog.pg_class c
         where c.oid=pg_catalog.to_regclass('public.xoxo_moderation_pin_security'))),
      ('xoxo_message_access_log RLS enabled',
        (select c.relrowsecurity from pg_catalog.pg_class c
         where c.oid=pg_catalog.to_regclass('public.xoxo_message_access_log'))),
      ('audit action has no CHECK constraint',
        not exists (select 1 from pg_catalog.pg_constraint c
          where c.conrelid=pg_catalog.to_regclass('public.xoxo_message_access_log')
            and c.contype='c')),
      ('audit log has no custom INSERT/UPDATE trigger',
        not exists (select 1 from pg_catalog.pg_trigger t
          where t.tgrelid=pg_catalog.to_regclass('public.xoxo_message_access_log')
            and not t.tgisinternal)),
      ('audit log ID has generated default',
        exists (select 1 from information_schema.columns c
          where c.table_schema='public' and c.table_name='xoxo_message_access_log'
            and c.column_name='id' and c.column_default like '%gen_random_uuid%')),
      ('private BETA schema not yet deployed',
        pg_catalog.to_regnamespace('xoxo_safety_private') is null),
      ('all BETA RPC names still unused',
        pg_catalog.to_regprocedure('public.xoxo_submit_conversation_report_beta(uuid,integer,text,uuid[],uuid)') is null
        and pg_catalog.to_regprocedure('public.xoxo_admin_list_conversation_reports_beta(text)') is null
        and pg_catalog.to_regprocedure('public.xoxo_admin_update_conversation_report_beta(uuid,text,text)') is null
        and pg_catalog.to_regprocedure('public.xoxo_admin_page_conversation_reports_beta(text,boolean,timestamptz,uuid,integer)') is null)
  ) as v(object_name,valid)
)
select category,object_name,
  case when coalesce(valid,false) then 'PASS' else 'BLOCK_RELEASE' end as status
from (
  select * from column_checks
  union all select * from routine_checks
  union all select * from structural_checks
) checks
order by category,object_name;
