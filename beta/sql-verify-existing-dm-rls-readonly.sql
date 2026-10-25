-- XOXO Avenue / Stay Safe, Sweetheart! -- RELEASE SAFETY CHECK ONLY.
-- Read-only catalog query; it accesses NO private message content.
-- Compared to project cxosofpxfmjkrhfabrqc on 2026-10-25.
-- Run again immediately BEFORE considering deployment of the BETA RPC.
-- BLOCK_RELEASE means the current SELECT RLS access rules have drifted;
-- re-audit the SECURITY DEFINER message-access checks before continuing.
-- Fingerprints match pg_policies.qual exactly, including SQL formatting.

with expected(table_name, policy_name, policy_fingerprint) as (
  values
   ('direct_messages', 'Users can view their own direct messages',
    'bf9b0ed4f378ca405a739cbd619a6819'),
   ('dm_conversation_clears', 'Users can view their own cleared conversations',
    '19300d155780585259ede73ac370586c')
), actual as (
  select p.tablename, p.policyname, p.cmd, p.permissive,
         p.roles::text as role_names, md5(p.qual) as policy_fingerprint,
         c.relrowsecurity
    from pg_catalog.pg_policies p
    join pg_catalog.pg_class c
      on c.oid=pg_catalog.to_regclass(
        pg_catalog.format('%I.%I',p.schemaname,p.tablename))
   where p.schemaname='public'
     and p.tablename in ('direct_messages','dm_conversation_clears')
     and p.cmd in ('SELECT','ALL')
)
select e.table_name, e.policy_name,
       case when count(a.policyname)=1
         and coalesce(bool_and(
           a.policyname=e.policy_name and a.cmd='SELECT'
           and a.permissive='PERMISSIVE'
           and a.role_names='{authenticated}'
           and a.relrowsecurity is true
           and a.policy_fingerprint=e.policy_fingerprint
         ),false)
       then 'PASS' else 'BLOCK_RELEASE' end as rls_contract_status
  from expected e
  left join actual a on a.tablename=e.table_name
 group by e.table_name,e.policy_name
 order by e.table_name;
