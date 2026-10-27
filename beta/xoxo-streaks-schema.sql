-- XOXO Streaks BETA — proposal only.
-- Do NOT run on production until the BETA branch is reviewed and explicitly approved.
-- Stores only per-pair/per-day activity flags; no message content is copied or retained.
begin;

create table if not exists public.xoxo_dm_streak_days (
  user_low uuid not null references auth.users(id) on delete cascade,
  user_high uuid not null references auth.users(id) on delete cascade,
  activity_date date not null,
  low_sent boolean not null default false,
  high_sent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_low, user_high, activity_date),
  constraint xoxo_dm_streak_pair_order check (user_low < user_high)
);

alter table public.xoxo_dm_streak_days enable row level security;
revoke all on public.xoxo_dm_streak_days from anon, authenticated;

create or replace function public.xoxo_record_dm_streak_activity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_low uuid;
  v_high uuid;
  v_day date;
begin
  -- Do not count disappearing content or replies to 24-hour Whispers.
  if new.sender_id is null or new.recipient_id is null
     or new.sender_id = new.recipient_id
     or new.whisper_id is not null
     or coalesce(new.media_view_mode, 'normal') <> 'normal' then
    return new;
  end if;

  v_low := least(new.sender_id, new.recipient_id);
  v_high := greatest(new.sender_id, new.recipient_id);
  v_day := (new.created_at at time zone 'UTC')::date;

  insert into public.xoxo_dm_streak_days
    (user_low, user_high, activity_date, low_sent, high_sent, updated_at)
  values
    (v_low, v_high, v_day, new.sender_id = v_low, new.sender_id = v_high, now())
  on conflict (user_low, user_high, activity_date)
  do update set
    low_sent = public.xoxo_dm_streak_days.low_sent or excluded.low_sent,
    high_sent = public.xoxo_dm_streak_days.high_sent or excluded.high_sent,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists xoxo_dm_streak_activity_after_insert on public.direct_messages;
create trigger xoxo_dm_streak_activity_after_insert
after insert on public.direct_messages
for each row execute function public.xoxo_record_dm_streak_activity();

create or replace function public.xoxo_get_dm_streak(p_other_user uuid)
returns table(current_streak integer, longest_streak integer, last_mutual_day date, next_milestone integer)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_me uuid := auth.uid();
  v_low uuid;
  v_high uuid;
  v_today date := (now() at time zone 'UTC')::date;
  v_latest date;
  v_day date;
  v_run integer := 0;
  v_current integer := 0;
  v_longest integer := 0;
  v_previous date;
  v_clear_cutoff date;
begin
  if v_me is null or p_other_user is null or v_me = p_other_user then
    return;
  end if;

  -- SECURITY GATE: SECURITY DEFINER bypasses the caller's RLS. Reject
  -- either-direction blocks server-side before reading private aggregates.
  -- The production DM INSERT policy uses this same public.user_blocks pair
  -- predicate; client-side hiding is not an authorization boundary.
  if exists (
    select 1
    from public.user_blocks b
    where (b.blocker_id = v_me and b.blocked_id = p_other_user)
       or (b.blocker_id = p_other_user and b.blocked_id = v_me)
  ) then
    return;
  end if;

  v_low := least(v_me, p_other_user);
  v_high := greatest(v_me, p_other_user);

  -- Respect this signed-in user's own clear state. Do not reset the other
  -- participant's view when only one person clears their local conversation.
  -- Exclude the cleared UTC day and all earlier activity because daily
  -- aggregates cannot distinguish messages before/after a clear on that day.
  select max((dc.cleared_at at time zone 'UTC')::date)
    into v_clear_cutoff
  from public.dm_conversation_clears dc
  where dc.user_id = v_me
    and dc.other_user_id = p_other_user;

  if not exists (
    select 1 from public.xoxo_dm_streak_days d
    where d.user_low = v_low and d.user_high = v_high
      and (v_clear_cutoff is null or d.activity_date > v_clear_cutoff)
  ) then
    return query select 0, 0, null::date, 3;
    return;
  end if;

  select max(d.activity_date) into v_latest
  from public.xoxo_dm_streak_days d
  where d.user_low = v_low and d.user_high = v_high
    and d.low_sent and d.high_sent
    and (v_clear_cutoff is null or d.activity_date > v_clear_cutoff);

  if v_latest is not null and v_latest >= v_today - 1 then
    for v_day in
      select d.activity_date
      from public.xoxo_dm_streak_days d
      where d.user_low = v_low and d.user_high = v_high
        and d.low_sent and d.high_sent
        and (v_clear_cutoff is null or d.activity_date > v_clear_cutoff)
        and d.activity_date <= v_latest
      order by d.activity_date desc
    loop
      if v_previous is null then
        v_run := 1;
      elsif v_day = v_previous - 1 then
        v_run := v_run + 1;
      else
        exit;
      end if;
      v_previous := v_day;
    end loop;
    v_current := v_run;
  end if;

  v_run := 0;
  v_previous := null;
  for v_day in
    select d.activity_date
    from public.xoxo_dm_streak_days d
    where d.user_low = v_low and d.user_high = v_high
      and d.low_sent and d.high_sent
      and (v_clear_cutoff is null or d.activity_date > v_clear_cutoff)
    order by d.activity_date
  loop
    if v_previous is null or v_day <> v_previous + 1 then
      v_run := 1;
    else
      v_run := v_run + 1;
    end if;
    if v_run > v_longest then v_longest := v_run; end if;
    v_previous := v_day;
  end loop;

  return query select
    v_current,
    v_longest,
    v_latest,
    case
      when v_current < 3 then 3
      when v_current < 7 then 7
      when v_current < 14 then 14
      when v_current < 30 then 30
      when v_current < 100 then 100
      else 100
    end;
end;
$$;

revoke all on function public.xoxo_record_dm_streak_activity() from public, anon, authenticated;
-- Keep the SECURITY DEFINER reader unavailable to every client role until
-- its canonical server-side conversation/block authorization check is implemented.
revoke all on function public.xoxo_get_dm_streak(uuid) from public, anon, authenticated;

commit;
