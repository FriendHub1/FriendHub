-- Store guest contact details and secure guest support sessions without exposing rows to browser roles.
alter table public.support_cases
  add column if not exists guest_email text,
  add column if not exists guest_name text,
  add column if not exists guest_token_hash text;
alter table public.support_cases
  drop constraint if exists support_cases_guest_email_format_check;
alter table public.support_cases
  add constraint support_cases_guest_email_format_check
  check (guest_email is null or guest_email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$');
create unique index if not exists support_cases_guest_token_hash_uidx
  on public.support_cases (guest_token_hash) where guest_token_hash is not null;
alter table public.support_messages alter column sender_id drop not null;
create table if not exists public.xoxo_support_guest_rate_limits (
  ip_hash text not null,
  window_start timestamptz not null,
  attempts integer not null default 1 check (attempts > 0),
  primary key (ip_hash, window_start)
);
alter table public.xoxo_support_guest_rate_limits enable row level security;
revoke all on public.xoxo_support_guest_rate_limits from public, anon, authenticated;
grant all on public.xoxo_support_guest_rate_limits to service_role;
create or replace function public.xoxo_support_guest_rate_limit(p_ip_hash text,p_max_attempts integer default 4)
returns boolean language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_attempts integer; v_window timestamptz := to_timestamp(floor(extract(epoch from now())/900)*900);
begin
 if p_ip_hash is null or p_ip_hash !~ '^[a-f0-9]{64}$' then return false; end if;
 insert into public.xoxo_support_guest_rate_limits(ip_hash,window_start,attempts) values(p_ip_hash,v_window,1)
 on conflict(ip_hash,window_start) do update set attempts=public.xoxo_support_guest_rate_limits.attempts+1
 returning attempts into v_attempts;
 return v_attempts <= greatest(1,least(coalesce(p_max_attempts,4),10));
end; $$;
revoke all on function public.xoxo_support_guest_rate_limit(text,integer) from public,anon,authenticated;
grant execute on function public.xoxo_support_guest_rate_limit(text,integer) to service_role;
