-- XOXO Avenue: retain direct messages when a non-admin account is deleted.
-- The archive is private, never restored to user inboxes, and is exposed only
-- through the existing PIN-gated admin moderation RPCs.
-- Archiving happens in the same transaction as account cleanup; if the archive
-- insert fails, the account deletion transaction fails too.

begin;

create schema if not exists xoxo_admin_private;
revoke all on schema xoxo_admin_private from public, anon, authenticated;

create table if not exists xoxo_admin_private.deleted_account_messages (
  archive_id bigint generated always as identity primary key,
  original_message_id uuid not null unique,
  sender_id uuid not null,
  recipient_id uuid not null,
  message_content text not null,
  message_created_at timestamptz not null,
  archived_at timestamptz not null default now(),
  deleted_account_id uuid not null,
  sender_username_snapshot text,
  recipient_username_snapshot text,
  sender_profile_photo_snapshot text,
  recipient_profile_photo_snapshot text,
  attachment_metadata jsonb
);

alter table xoxo_admin_private.deleted_account_messages
  add column if not exists sender_username_snapshot text,
  add column if not exists recipient_username_snapshot text,
  add column if not exists sender_profile_photo_snapshot text,
  add column if not exists recipient_profile_photo_snapshot text;

create index if not exists deleted_account_messages_pair_created_idx
  on xoxo_admin_private.deleted_account_messages(sender_id, recipient_id, message_created_at desc, original_message_id desc);
create index if not exists deleted_account_messages_deleted_account_idx
  on xoxo_admin_private.deleted_account_messages(deleted_account_id, message_created_at desc);

alter table xoxo_admin_private.deleted_account_messages enable row level security;
revoke all on xoxo_admin_private.deleted_account_messages from public, anon, authenticated;

create table if not exists xoxo_admin_private.deleted_dm_archive_access_log (
  id bigint generated always as identity primary key,
  admin_id uuid not null,
  accessed_at timestamptz not null default now(),
  reason text not null,
  result_count integer not null default 0
);
alter table xoxo_admin_private.deleted_dm_archive_access_log enable row level security;
revoke all on xoxo_admin_private.deleted_dm_archive_access_log from public, anon, authenticated;

create or replace function public.xoxo_delete_account_data(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if exists (
    select 1 from public.xoxo_admins where user_id = p_user_id
  ) then
    raise exception 'Administrator accounts cannot be deleted here';
  end if;

  delete from public.post_comments
  where post_id in (
    select p.id::text from public.posts p where p.user_id = p_user_id
  );

  delete from public.comment_likes where user_id = p_user_id;
  delete from public.post_comments where user_id = p_user_id;

  delete from public.dm_reactions where user_id = p_user_id;
  delete from public.dm_typing where user_id = p_user_id or recipient_id = p_user_id;
  delete from public.dm_buzzes where sender_id = p_user_id or recipient_id = p_user_id;
  delete from public.dm_conversation_clears where user_id = p_user_id or other_user_id = p_user_id;
  delete from public.dm_conversation_pins where user_id = p_user_id or other_user_id = p_user_id;

  /*
   * ARCHIVE BEFORE DELETION.
   * No ON CONFLICT fallback is used: if an archive row cannot be written,
   * the transaction aborts and the live messages are not deleted.
   * Identity snapshots keep the existing admin viewer useful after profiles
   * and the Auth user have been removed.
   */
  insert into xoxo_admin_private.deleted_account_messages
    (original_message_id, sender_id, recipient_id, message_content,
     message_created_at, deleted_account_id,
     sender_username_snapshot, recipient_username_snapshot,
     sender_profile_photo_snapshot, recipient_profile_photo_snapshot,
     attachment_metadata)
  select dm.id,
         dm.sender_id,
         dm.recipient_id,
         dm.content,
         dm.created_at,
         p_user_id,
         sender_profile.username,
         recipient_profile.username,
         sender_profile.profile_photo,
         recipient_profile.profile_photo,
         to_jsonb(dm) - 'id' - 'sender_id' - 'recipient_id' - 'content' - 'created_at'
  from public.direct_messages dm
  left join public.profiles sender_profile on sender_profile.user_id = dm.sender_id
  left join public.profiles recipient_profile on recipient_profile.user_id = dm.recipient_id
  where dm.sender_id = p_user_id or dm.recipient_id = p_user_id;

  delete from public.direct_messages
  where sender_id = p_user_id or recipient_id = p_user_id;

  delete from public.post_likes where user_id = p_user_id;
  delete from public.saved_posts where user_id = p_user_id;
  delete from public.notifications where user_id = p_user_id;

  delete from public.posts where user_id = p_user_id;

  delete from public.support_messages where sender_id = p_user_id;
  delete from public.support_typing where user_id = p_user_id;
  delete from public.support_cases where user_id = p_user_id;

  delete from public.push_subscriptions where user_id = p_user_id;
  delete from public.user_presence where user_id = p_user_id;
  delete from public.profile_reminder_emails where user_id = p_user_id;
  delete from public.welcome_email_deliveries where user_id = p_user_id;

  delete from public.xoxo_user_moderation where user_id = p_user_id;

  delete from public.profile_views
  where profile_id in (
    select p.id from public.profiles p where p.user_id = p_user_id
  );

  delete from public.friendhub_public_profiles where user_id = p_user_id;
  delete from public."Profiles" where user_id = p_user_id;
  delete from public.profiles where user_id = p_user_id;
end;
$function$;

revoke all on function public.xoxo_delete_account_data(uuid) from public, anon, authenticated;
grant execute on function public.xoxo_delete_account_data(uuid) to service_role;

/* Existing Message Moderation conversation list: include archived conversations. */
create or replace function public.xoxo_admin_list_dm_conversations()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  result jsonb;
begin
  if auth.uid() is null or not exists (
    select 1 from public.xoxo_admins a where a.user_id = auth.uid()
  ) then
    raise exception 'Administrator access required';
  end if;

  select coalesce(jsonb_agg(to_jsonb(t) order by t.last_at desc), '[]'::jsonb)
  into result
  from (
    with combined as (
      select dm.sender_id, dm.recipient_id, dm.created_at as message_at
      from public.direct_messages dm
      union all
      select a.sender_id, a.recipient_id, a.message_created_at
      from xoxo_admin_private.deleted_account_messages a
    ), normalized as (
      select least(sender_id, recipient_id) as user_1,
             greatest(sender_id, recipient_id) as user_2,
             message_at
      from combined
    )
    select user_1, user_2, count(*)::integer as message_count, max(message_at) as last_at
    from normalized
    group by user_1, user_2
    order by last_at desc
    limit 100
  ) t;

  return result;
end;
$function$;

/* Existing Message Moderation viewer: live + archived history through the same PIN-gated RPC. */
create or replace function public.xoxo_admin_read_dm_page(
  p_user_1 uuid,
  p_user_2 uuid,
  p_reason text,
  p_before_at timestamptz,
  p_before_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_reason text:=btrim(coalesce(p_reason,''));
  v_result jsonb;
begin
  if auth.uid() is null or not exists(select 1 from public.xoxo_admins where user_id=auth.uid()) then
    raise exception 'Administrator access required';
  end if;
  if not exists(
    select 1 from public.xoxo_moderation_pin_security
    where admin_id=auth.uid()
      and verified_until>now()
      and (locked_until is null or locked_until<=now())
  ) then
    raise exception 'Moderation PIN verification required';
  end if;
  if p_user_1 is null or p_user_2 is null or p_user_1=p_user_2 then
    raise exception 'Invalid conversation';
  end if;
  if length(v_reason)<10 or length(v_reason)>300 then
    raise exception 'A moderation reason of 10 to 300 characters is required';
  end if;
  if (p_before_at is null)<>(p_before_id is null) then
    raise exception 'Invalid pagination cursor';
  end if;
  if not exists(
    select 1
    from public.direct_messages dm
    where (dm.sender_id=p_user_1 and dm.recipient_id=p_user_2)
       or (dm.sender_id=p_user_2 and dm.recipient_id=p_user_1)
    union all
    select 1
    from xoxo_admin_private.deleted_account_messages a
    where (a.sender_id=p_user_1 and a.recipient_id=p_user_2)
       or (a.sender_id=p_user_2 and a.recipient_id=p_user_1)
    limit 1
  ) then
    raise exception 'Conversation not found';
  end if;

  insert into public.xoxo_message_access_log(admin_id,conversation_user_1,conversation_user_2,action)
  values(auth.uid(),least(p_user_1,p_user_2),greatest(p_user_1,p_user_2),'view_conversation_page: '||v_reason);

  select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at,t.id),'[]'::jsonb)
  into v_result
  from (
    with combined as (
      select dm.id,
             dm.created_at,
             dm.sender_id,
             dm.recipient_id,
             dm.content,
             dm.is_read,
             dm.attachment_type,
             dm.attachment_name,
             dm.edited_at
      from public.direct_messages dm
      where (dm.sender_id=p_user_1 and dm.recipient_id=p_user_2)
         or (dm.sender_id=p_user_2 and dm.recipient_id=p_user_1)

      union all

      select a.original_message_id as id,
             a.message_created_at as created_at,
             a.sender_id,
             a.recipient_id,
             a.message_content as content,
             false as is_read,
             a.attachment_metadata->>'attachment_type' as attachment_type,
             a.attachment_metadata->>'attachment_name' as attachment_name,
             case
               when coalesce(a.attachment_metadata->>'edited_at','') <> ''
               then (a.attachment_metadata->>'edited_at')::timestamptz
               else null
             end as edited_at
      from xoxo_admin_private.deleted_account_messages a
      where (a.sender_id=p_user_1 and a.recipient_id=p_user_2)
         or (a.sender_id=p_user_2 and a.recipient_id=p_user_1)
    )
    select id,created_at,sender_id,recipient_id,content,is_read,attachment_type,attachment_name,edited_at
    from combined
    where p_before_at is null or (created_at,id)<(p_before_at,p_before_id)
    order by created_at desc,id desc
    limit 100
  ) t;

  return v_result;
end;
$function$;

/* Keep the existing PIN wrapper contract intact. */
create or replace function public.xoxo_admin_read_dm_page_pin(
  p_user_1 uuid,
  p_user_2 uuid,
  p_reason text,
  p_before_at timestamptz,
  p_before_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare v_user uuid:=auth.uid();
begin
 if v_user is null or not exists(select 1 from public.xoxo_admins where user_id=v_user) then raise exception 'Administrator access required'; end if;
 if not exists(select 1 from public.xoxo_moderation_pin_security where admin_id=v_user and verified_until>now() and (locked_until is null or locked_until<=now())) then raise exception 'Moderation PIN verification required'; end if;
 return public.xoxo_admin_read_dm_page(p_user_1,p_user_2,p_reason,p_before_at,p_before_id);
end
$function$;

/* Existing profile-photo RPC: fall back to archived identity snapshots for deleted accounts. */
create or replace function public.xoxo_admin_dm_profile_photos(p_user_ids uuid[])
returns table(user_id uuid, username text, profile_photo text)
language sql
security definer
set search_path to ''
as $function$
  with live_profiles as (
    select p.user_id, p.username, p.profile_photo, 0 as priority
    from public.profiles p
    where public.is_xoxo_admin()
      and p.user_id = any(p_user_ids)
  ), archived_profiles as (
    select a.sender_id as user_id, a.sender_username_snapshot as username,
           a.sender_profile_photo_snapshot as profile_photo, 1 as priority
    from xoxo_admin_private.deleted_account_messages a
    where public.is_xoxo_admin()
      and a.sender_id = any(p_user_ids)
      and a.sender_username_snapshot is not null
    union all
    select a.recipient_id as user_id, a.recipient_username_snapshot as username,
           a.recipient_profile_photo_snapshot as profile_photo, 1 as priority
    from xoxo_admin_private.deleted_account_messages a
    where public.is_xoxo_admin()
      and a.recipient_id = any(p_user_ids)
      and a.recipient_username_snapshot is not null
  ), ranked as (
    select user_id, username, profile_photo,
           row_number() over (partition by user_id order by priority, username nulls last) as rn
    from (
      select * from live_profiles
      union all
      select * from archived_profiles
    ) all_profiles
  )
  select user_id, username, profile_photo
  from ranked
  where rn=1
  limit 200;
$function$;

/* Include archived messages in the existing moderation totals. */
create or replace function public.get_xoxo_admin_message_stats()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if not public.is_xoxo_admin() then
    raise exception 'Access denied: administrator required';
  end if;

  return (
    with combined as (
      select sender_id, recipient_id, is_read
      from public.direct_messages
      union all
      select sender_id, recipient_id, false as is_read
      from xoxo_admin_private.deleted_account_messages
    )
    select jsonb_build_object(
      'total_messages', count(*),
      'conversations', count(distinct (least(sender_id, recipient_id), greatest(sender_id, recipient_id))),
      'unread_messages', count(*) filter (where is_read=false)
    )
    from combined
  );
end;
$function$;

revoke all on function public.xoxo_admin_list_deleted_account_messages(text, integer)
  from public, anon, authenticated;
grant execute on function public.xoxo_admin_list_deleted_account_messages(text, integer)
  to authenticated;

commit;
