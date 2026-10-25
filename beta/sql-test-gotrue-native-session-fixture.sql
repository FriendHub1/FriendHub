-- Only the DISPOSABLE self-hosted GoTrue database. Auth migrations have
-- already created the REAL auth.users and auth.sessions tables in this DB.
-- Never install these test helpers on the actual Supabase project.
\set ON_ERROR_STOP on

do $verify_isolated_auth$
begin
  if current_database() <> 'xoxo_gotrue_ci' or
     to_regclass('auth.sessions') is null or
     to_regclass('auth.users') is null then
    raise exception 'Native Auth fixture requires a migrated disposable GoTrue database';
  end if;
end $verify_isolated_auth$;

-- Roles are PostgreSQL-cluster-wide, established earlier by the separate
-- contract fixture. Keep the native Auth records and migrations untouched.
grant anon, authenticated to xoxo_ci_authenticator;
grant usage on schema public to anon, authenticated;
grant usage on schema auth to authenticated;

-- The self-hosted Auth container only manages Auth tables. The SQL helpers
-- that the hosted Supabase PostgREST gateway provides are defined locally
-- to interpret the SIGNED JWT that PostgREST itself has already verified.
create or replace function auth.uid() returns uuid
language sql stable set search_path=''
as $native_uid$
 select coalesce(
   nullif(current_setting('request.jwt.claim.sub', true),''),
   nullif(current_setting('request.jwt.claims', true),'')::jsonb->>'sub'
 )::uuid
$native_uid$;
create or replace function auth.jwt() returns jsonb
language sql stable set search_path=''
as $native_jwt$
 select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,
    '{}'::jsonb)
$native_jwt$;
grant execute on function auth.uid() to anon, authenticated;
grant execute on function auth.jwt() to anon, authenticated;

create table public.direct_messages (
 id uuid primary key,
 sender_id uuid not null,
 recipient_id uuid not null,
 content text,
 whisper_id uuid,
 media_view_mode text default 'normal',
 created_at timestamptz not null default now()
);
create table public.dm_conversation_clears (
 user_id uuid not null,
 other_user_id uuid not null,
 cleared_at timestamptz not null,
 primary key(user_id,other_user_id)
);
create table public.xoxo_admins (user_id uuid primary key);
create table public.xoxo_moderation_pin_security (
 admin_id uuid primary key,
 verified_until timestamptz,
 locked_until timestamptz
);
create table public.xoxo_message_access_log (
 id uuid primary key default gen_random_uuid(),
 admin_id uuid not null,
 conversation_user_1 uuid not null,
 conversation_user_2 uuid not null,
 action text not null,
 accessed_at timestamptz not null default now()
);
create or replace function public.is_xoxo_admin() returns boolean
language sql stable security definer set search_path=''
as $native_admin$
 select auth.uid() is not null and exists(
   select 1 from public.xoxo_admins a where a.user_id=auth.uid())
$native_admin$;
revoke all on function public.is_xoxo_admin() from public, anon, authenticated;
grant execute on function public.is_xoxo_admin() to authenticated;

alter table public.direct_messages enable row level security;
alter table public.dm_conversation_clears enable row level security;
grant select on public.direct_messages to authenticated;
grant select on public.dm_conversation_clears to authenticated;
create policy native_dm_clears_are_private on public.dm_conversation_clears
 for select to authenticated using (user_id=auth.uid());
create policy native_dm_visible_to_participant on public.direct_messages
 for select to authenticated using (
  (sender_id=auth.uid() or recipient_id=auth.uid())
  and not exists (
   select 1 from public.dm_conversation_clears c
   where c.user_id=auth.uid()
    and c.other_user_id=case when auth.uid()=sender_id
      then recipient_id else sender_id end
    and public.direct_messages.created_at<=c.cleared_at
  )
 );
