-- Public-safe username lookup for short profile URLs.
-- Returns at most two matches so the Worker can reject ambiguous usernames.
-- Admin and beta-tester profiles are intentionally excluded from public resolution.

create or replace function public.get_public_profile_id_by_username(target_username text)
returns table(user_id uuid)
language sql
stable
security definer
set search_path = public
as $function$
  select p.user_id
  from public.friendhub_public_profiles p
  where lower(regexp_replace(trim(p.username), '^@+', '')) =
        lower(regexp_replace(trim(coalesce(target_username, '')), '^@+', ''))
    and not exists (
      select 1 from public.xoxo_admins a where a.user_id = p.user_id
    )
    and not public.sl_is_beta_tester(p.user_id)
  order by p.user_id
  limit 2;
$function$;

revoke all on function public.get_public_profile_id_by_username(text) from public;
grant execute on function public.get_public_profile_id_by_username(text) to anon, authenticated;
