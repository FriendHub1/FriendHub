-- XOXO Avenue — Stay Safe, Sweetheart! BETA live-schema compatibility check.
-- READ ONLY: queries PostgreSQL catalogs, NEVER selects private message rows.
-- Safe to re-run before requesting permission for any migration or release.
-- It does NOT create tables, execute application RPCs or verify user data.

with required_columns(schema_name,table_name,column_name,type_name) as (
  values
    ('auth','sessions','id','uuid'),
    ('auth','sessions','user_id','uuid'),
    ('auth','sessions','not_after','timestamptz'),
    ('public','direct_messages','id','uuid'),
    ('public','direct_messages','sender_id','uuid'),
    ('public','direct_messages','recipient_id','uuid'),
    ('public','direct_messages','created_at','timestamptz'),
    ('public','direct_messages','whisper_id','uuid'),
    ('public','direct_messages','media_view_mode','text'),
    ('public','dm_conversation_clears','user_id','uuid'),
    ('public','dm_conversation_clears','other_user_id','uuid'),
    ('public','dm_conversation_clears','cleared_at','timestamptz'),
    ('public','xoxo_admins','user_id','uuid'),
    ('public','xoxo_moderation_pin_security','admin_id','uuid'),
    ('public','xoxo_moderation_pin_security','verified_until','timestamptz'),
    ('public','xoxo_moderation_pin_security','locked_until','timestamptz'),
    ('public','xoxo_message_access_log','admin_id','uuid'),
    ('public','xoxo_message_access_log','conversation_user_1','uuid'),
    ('public','xoxo_message_access_log','conversation_user_2','uuid'),
    ('public','xoxo_message_access_log','action','text'),
    ('public','direct_message_reports','id','uuid'),
    ('public','direct_message_reports','reporter_id','uuid')
),
required_functions(signature) as (
  values
    ('auth.uid()'),
    ('auth.jwt()'),
    ('public.is_xoxo_admin()'),
    ('public.xoxo_moderation_pin_status()'),
    ('public.xoxo_moderation_pin_verify(text)'),
    ('public.xoxo_admin_read_dm_page_pin(uuid,uuid,text,timestamptz,uuid)'),
    ('public.xoxo_admin_list_dm_conversations()'),
    ('public.get_xoxo_dm_reports()'),
    ('public.update_xoxo_dm_report_status(uuid,text)')
),
required_rls(schema_name,table_name) as (
  values
    ('public','direct_messages'),
    ('public','dm_conversation_clears'),
    ('public','direct_message_reports'),
    ('public','xoxo_moderation_pin_security'),
    ('public','xoxo_message_access_log')
),
checks as (
  select 'column'::text as category,
    c.schema_name||'.'||c.table_name||'.'||c.column_name||' '||c.type_name
      as target,
    exists (
      select 1 from pg_catalog.pg_attribute a
      join pg_catalog.pg_class rel on rel.oid=a.attrelid
      join pg_catalog.pg_namespace ns on ns.oid=rel.relnamespace
      where ns.nspname=c.schema_name and rel.relname=c.table_name
        and a.attname=c.column_name and a.atttypid=to_regtype(c.type_name)
        and a.attnum>0 and not a.attisdropped
    ) as ok
  from required_columns c
  union all
  select 'function',f.signature,to_regprocedure(f.signature) is not null
    from required_functions f
  union all
  select 'rls',r.schema_name||'.'||r.table_name,
    exists (
      select 1 from pg_catalog.pg_class rel
      join pg_catalog.pg_namespace ns on ns.oid=rel.relnamespace
      where ns.nspname=r.schema_name and rel.relname=r.table_name
        and rel.relkind in ('r','p') and rel.relrowsecurity
    )
  from required_rls r
)
select
  pg_catalog.count(*)::integer as checks_run,
  pg_catalog.bool_and(ok) as live_schema_compatible,
  coalesce(pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object('category',category,'target',target)
    order by category,target) filter (where not ok),'[]'::jsonb) as failed_checks,
  -- Informational only: the BETA RPC should not exist before authorization.
  to_regprocedure(
    'public.xoxo_submit_conversation_report_beta(uuid,integer,text,uuid[],uuid)'
  ) is not null as beta_submission_rpc_installed
from checks;
