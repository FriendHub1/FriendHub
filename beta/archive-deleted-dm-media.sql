-- XOXO Avenue: preserve DM attachment objects on self-service account deletion.
-- Applied to Supabase project cxosofpxfmjkrhfabrqc.
-- Moves objects inside the existing private dm-media bucket with the service key;
-- this avoids duplicate storage and removes the deleted user as Storage owner.

begin;

create table if not exists xoxo_admin_private.deleted_account_media (
  id bigint generated always as identity primary key,
  deleted_account_id uuid not null,
  original_bucket text not null default 'dm-media',
  original_path text not null,
  archived_bucket text not null default 'dm-media',
  archived_path text not null,
  mime_type text,
  file_size bigint,
  archived_at timestamptz not null default now(),
  unique (deleted_account_id, original_bucket, original_path)
);
alter table xoxo_admin_private.deleted_account_media enable row level security;
revoke all on xoxo_admin_private.deleted_account_media from public, anon, authenticated;

create or replace function public.xoxo_record_deleted_account_media(
  p_user_id uuid, p_original_path text, p_archived_path text,
  p_mime_type text default null, p_file_size bigint default null
) returns void
language plpgsql security definer set search_path=''
as $function$
begin
  if p_user_id is null or p_original_path is null or p_archived_path is null
     or length(p_original_path)>1024 or length(p_archived_path)>1024
     or p_original_path like '%..%'
     or p_archived_path not like '__deleted_accounts/'||p_user_id::text||'/%'
  then raise exception 'Invalid archive media path'; end if;
  if exists(select 1 from public.xoxo_admins where user_id=p_user_id) then
    raise exception 'Administrator accounts cannot be archived here';
  end if;
  insert into xoxo_admin_private.deleted_account_media
    (deleted_account_id,original_path,archived_path,mime_type,file_size)
  values (p_user_id,p_original_path,p_archived_path,p_mime_type,p_file_size)
  on conflict (deleted_account_id,original_bucket,original_path)
  do update set archived_path=excluded.archived_path,
    mime_type=coalesce(excluded.mime_type,xoxo_admin_private.deleted_account_media.mime_type),
    file_size=coalesce(excluded.file_size,xoxo_admin_private.deleted_account_media.file_size);
end;
$function$;
revoke all on function public.xoxo_record_deleted_account_media(uuid,text,text,text,bigint) from public, anon, authenticated;
grant execute on function public.xoxo_record_deleted_account_media(uuid,text,text,text,bigint) to service_role;

-- xoxo_delete_account_data now joins deleted_account_media while archiving each
-- direct_messages row and rewrites attachment_metadata.attachment_path to archived_path.
-- Its complete deployed definition is maintained by the Supabase migration history.

create or replace function public.xoxo_admin_read_dm_page(
  p_user_1 uuid, p_user_2 uuid, p_reason text,
  p_before_at timestamptz default null, p_before_id uuid default null
) returns jsonb
language plpgsql security definer set search_path=''
as $function$
declare v_reason text:=btrim(coalesce(p_reason,'')); v_result jsonb;
begin
  if auth.uid() is null or not exists(select 1 from public.xoxo_admins where user_id=auth.uid()) then raise exception 'Administrator access required'; end if;
  if not exists(select 1 from public.xoxo_moderation_pin_security where admin_id=auth.uid() and verified_until>now() and (locked_until is null or locked_until<=now())) then raise exception 'Moderation PIN verification required'; end if;
  if p_user_1 is null or p_user_2 is null or p_user_1=p_user_2 then raise exception 'Invalid conversation'; end if;
  if length(v_reason)<10 or length(v_reason)>300 then raise exception 'A moderation reason of 10 to 300 characters is required'; end if;
  if (p_before_at is null)<>(p_before_id is null) then raise exception 'Invalid pagination cursor'; end if;
  if not exists(
    select 1 from public.direct_messages dm where (dm.sender_id=p_user_1 and dm.recipient_id=p_user_2) or (dm.sender_id=p_user_2 and dm.recipient_id=p_user_1)
    union all
    select 1 from xoxo_admin_private.deleted_account_messages a where (a.sender_id=p_user_1 and a.recipient_id=p_user_2) or (a.sender_id=p_user_2 and a.recipient_id=p_user_1)
    limit 1
  ) then raise exception 'Conversation not found'; end if;
  insert into public.xoxo_message_access_log(admin_id,conversation_user_1,conversation_user_2,action)
  values(auth.uid(),least(p_user_1,p_user_2),greatest(p_user_1,p_user_2),'view_conversation_page: '||v_reason);
  select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at,t.id),'[]'::jsonb) into v_result
  from (
    with combined as (
      select dm.id,dm.created_at,dm.sender_id,dm.recipient_id,dm.content,dm.is_read,
             dm.attachment_type,dm.attachment_name,dm.attachment_path,dm.edited_at
      from public.direct_messages dm
      where (dm.sender_id=p_user_1 and dm.recipient_id=p_user_2) or (dm.sender_id=p_user_2 and dm.recipient_id=p_user_1)
      union all
      select a.original_message_id,a.message_created_at,a.sender_id,a.recipient_id,a.message_content,
             false,a.attachment_metadata->>'attachment_type',a.attachment_metadata->>'attachment_name',
             a.attachment_metadata->>'attachment_path',
             case when coalesce(a.attachment_metadata->>'edited_at','')<>'' then (a.attachment_metadata->>'edited_at')::timestamptz else null end
      from xoxo_admin_private.deleted_account_messages a
      where (a.sender_id=p_user_1 and a.recipient_id=p_user_2) or (a.sender_id=p_user_2 and a.recipient_id=p_user_1)
    )
    select id,created_at,sender_id,recipient_id,content,is_read,attachment_type,attachment_name,attachment_path,edited_at
    from combined where p_before_at is null or (created_at,id)<(p_before_at,p_before_id)
    order by created_at desc,id desc limit 100
  ) t;
  return v_result;
end;
$function$;

drop policy if exists "XOXO admins can view archived DM media with verified PIN" on storage.objects;
create policy "XOXO admins can view archived DM media with verified PIN"
on storage.objects for select to authenticated
using (
  bucket_id='dm-media'
  and name like '__deleted_accounts/%'
  and public.is_xoxo_admin()
  and exists (
    select 1 from public.xoxo_moderation_pin_security ps
    where ps.admin_id=auth.uid() and ps.verified_until>now()
      and (ps.locked_until is null or ps.locked_until<=now())
  )
);

commit;
