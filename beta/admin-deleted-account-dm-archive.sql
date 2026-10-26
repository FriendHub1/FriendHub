-- XOXO Avenue: retain direct messages when a non-admin account is deleted.
-- This migration preserves the live account-cleanup routine and archives DMs
-- in the same transaction before they are removed from public.direct_messages.
-- Review against production schema before applying.

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
  attachment_metadata jsonb
);
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
  /*
   * SAFETY: administrator accounts cannot be deleted through this flow.
   */
  if exists (
    select 1 from public.xoxo_admins where user_id = p_user_id
  ) then
    raise exception 'Administrator accounts cannot be deleted here';
  end if;

  /*
   * COMMENTS ON POSTS OWNED BY THE USER
   * post_comments.post_id is TEXT, so delete before deleting posts.
   */
  delete from public.post_comments
  where post_id in (
    select p.id::text from public.posts p where p.user_id = p_user_id
  );

  /* USER'S OWN COMMENT ACTIVITY */
  delete from public.comment_likes where user_id = p_user_id;
  delete from public.post_comments where user_id = p_user_id;

  /* DIRECT MESSAGE RELATED ACTIVITY */
  delete from public.dm_reactions where user_id = p_user_id;
  delete from public.dm_typing where user_id = p_user_id or recipient_id = p_user_id;
  delete from public.dm_buzzes where sender_id = p_user_id or recipient_id = p_user_id;
  delete from public.dm_conversation_clears where user_id = p_user_id or other_user_id = p_user_id;
  delete from public.dm_conversation_pins where user_id = p_user_id or other_user_id = p_user_id;

  /*
   * ARCHIVE MESSAGE ROWS BEFORE DELETION.
   * The archived copy includes all currently known message fields, including
   * attachment metadata and media-view state. This is atomic with cleanup.
   */
  insert into xoxo_admin_private.deleted_account_messages
    (original_message_id, sender_id, recipient_id, message_content,
     message_created_at, deleted_account_id, attachment_metadata)
  select dm.id, dm.sender_id, dm.recipient_id, dm.content,
         dm.created_at, p_user_id,
         to_jsonb(dm) - 'id' - 'sender_id' - 'recipient_id' - 'content' - 'created_at'
  from public.direct_messages dm
  where dm.sender_id = p_user_id or dm.recipient_id = p_user_id
  on conflict (original_message_id) do nothing;

  delete from public.direct_messages
  where sender_id = p_user_id or recipient_id = p_user_id;

  /* SOCIAL DATA */
  delete from public.post_likes where user_id = p_user_id;
  delete from public.saved_posts where user_id = p_user_id;
  delete from public.notifications where user_id = p_user_id;

  /*
   * POSTS: related likes, saved posts, notifications and reports connected
   * through foreign keys may cascade from here, as in the existing function.
   */
  delete from public.posts where user_id = p_user_id;

  /* SUPPORT */
  delete from public.support_messages where sender_id = p_user_id;
  delete from public.support_typing where user_id = p_user_id;
  delete from public.support_cases where user_id = p_user_id;

  /* PUSH / PRESENCE / EMAIL TRACKING */
  delete from public.push_subscriptions where user_id = p_user_id;
  delete from public.user_presence where user_id = p_user_id;
  delete from public.profile_reminder_emails where user_id = p_user_id;
  delete from public.welcome_email_deliveries where user_id = p_user_id;

  /* MODERATION RECORD FOR THIS USER */
  delete from public.xoxo_user_moderation where user_id = p_user_id;

  /* PROFILE VIEWS REFERENCING THE USER'S LIVE PROFILE */
  delete from public.profile_views
  where profile_id in (
    select p.id from public.profiles p where p.user_id = p_user_id
  );

  /* PROFILE COPIES */
  delete from public.friendhub_public_profiles where user_id = p_user_id;
  delete from public."Profiles" where user_id = p_user_id;

  /* LIVE PROFILE LAST; preserve existing cascading behavior. */
  delete from public.profiles where user_id = p_user_id;
end;
$function$;

revoke all on function public.xoxo_delete_account_data(uuid) from public, anon, authenticated;
grant execute on function public.xoxo_delete_account_data(uuid) to service_role;

create or replace function public.xoxo_admin_list_deleted_account_messages(
  p_reason text,
  p_limit integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_reason text := pg_catalog.btrim(coalesce(p_reason, ''));
  v_rows jsonb;
  v_count integer;
begin
  if auth.uid() is null or not public.is_xoxo_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.xoxo_moderation_pin_security ps
    where ps.admin_id = auth.uid()
      and ps.verified_until > now()
      and (ps.locked_until is null or ps.locked_until <= now())
  ) then
    raise exception 'Moderation PIN verification required' using errcode = '42501';
  end if;

  if pg_catalog.length(v_reason) not between 10 and 300
     or v_reason ~ '[[:cntrl:]]' then
    raise exception 'A 10–300 character moderation reason is required' using errcode = '22023';
  end if;
  if p_limit is null or p_limit not between 1 and 200 then
    raise exception 'Limit must be between 1 and 200' using errcode = '22023';
  end if;

  select coalesce(jsonb_agg(to_jsonb(q) order by q.archived_at desc, q.archive_id desc), '[]'::jsonb)
  into v_rows
  from (
    select archive_id, original_message_id, sender_id, recipient_id,
           message_content, message_created_at, archived_at,
           deleted_account_id, attachment_metadata
    from xoxo_admin_private.deleted_account_messages
    order by archived_at desc, archive_id desc
    limit p_limit
  ) q;

  v_count := jsonb_array_length(v_rows);
  insert into xoxo_admin_private.deleted_dm_archive_access_log
    (admin_id, reason, result_count)
  values (auth.uid(), v_reason, v_count);

  return v_rows;
end;
$function$;

revoke all on function public.xoxo_admin_list_deleted_account_messages(text, integer)
  from public, anon, authenticated;
grant execute on function public.xoxo_admin_list_deleted_account_messages(text, integer)
  to authenticated;

commit;
