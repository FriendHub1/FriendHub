-- XOXO Avenue / isolated PostgreSQL 17 safety-contract fixtures.
-- Run ONLY against a freshly created disposable CI database, NEVER live Supabase.
\set ON_ERROR_STOP on

create role anon nologin;
create role authenticated nologin;
create role service_role nologin;

create schema auth;
create function auth.uid() returns uuid
  language sql stable set search_path=''
  as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
-- Simulate the server-signed JWT's session_id in this disposable CI database.
-- It is NOT a real Supabase access token; production auth.jwt() is untouched.
create function auth.jwt() returns jsonb
  language sql stable set search_path=''
  as 'select jsonb_build_object(
    ''session_id'', nullif(current_setting(''request.jwt.claim.session_id'',true),'''')
  )';
grant execute on function auth.jwt() to anon, authenticated;

create table auth.sessions (
  id uuid primary key,
  user_id uuid not null,
  not_after timestamptz
);
insert into auth.sessions(id,user_id) values
 ('aaaaaaaa-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111'),
 ('bbbbbbbb-0000-4000-8000-000000000002','22222222-2222-4222-8222-222222222222'),
 ('cccccccc-0000-4000-8000-000000000003','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
 ('dddddddd-0000-4000-8000-000000000004','33333333-3333-4333-8333-333333333333');
grant usage on schema public to anon, authenticated;

create table public.direct_messages (
  id uuid primary key,
  sender_id uuid not null,
  recipient_id uuid not null,
  content text,
  created_at timestamptz not null default now()
);

create table public.dm_conversation_clears (
  user_id uuid not null,
  other_user_id uuid not null,
  cleared_at timestamptz not null,
  primary key(user_id, other_user_id)
);

create table public.xoxo_admins (
  user_id uuid primary key
);
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

create function public.is_xoxo_admin() returns boolean
  language sql stable security definer set search_path=''
  as $$ select auth.uid() is not null and exists(
    select 1 from public.xoxo_admins a where a.user_id = auth.uid()
  ) $$;
revoke all on function public.is_xoxo_admin() from public, anon, authenticated;
grant execute on function public.is_xoxo_admin() to authenticated;

alter table public.direct_messages enable row level security;
alter table public.dm_conversation_clears enable row level security;
grant select on public.direct_messages to authenticated;
grant select on public.dm_conversation_clears to authenticated;
create policy cleared_state_is_private on public.dm_conversation_clears
  for select to authenticated using (user_id = auth.uid());
create policy dm_visible_for_user on public.direct_messages
  for select to authenticated using (
    (auth.uid() = sender_id or auth.uid() = recipient_id)
    and not exists (
      select 1 from public.dm_conversation_clears c
      where c.user_id = auth.uid()
        and c.other_user_id = case
          when auth.uid() = sender_id then recipient_id else sender_id end
        and public.direct_messages.created_at <= c.cleared_at
    )
  );

insert into public.direct_messages(id, sender_id, recipient_id, content, created_at) values
 ('77777777-7777-4777-8777-777777777771','11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','Authorized',now()-interval '1 day'),
 ('77777777-7777-4777-8777-777777777772','22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111','Authorized reply',now()-interval '1 day'),
 ('77777777-7777-4777-8777-777777777773','33333333-3333-4333-8333-333333333333','22222222-2222-4222-8222-222222222222','Outside conversation',now());

insert into public.xoxo_admins(user_id) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
insert into public.xoxo_moderation_pin_security(admin_id,verified_until)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', now()-interval '1 hour');
