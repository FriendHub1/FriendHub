-- Keep guest support media private and constrain uploads to the types handled by the UI.
update storage.buckets
set public = false,
    file_size_limit = 31457280,
    allowed_mime_types = array[
      'image/jpeg','image/png','image/webp','image/gif',
      'video/mp4','video/quicktime','video/webm'
    ]
where id = 'support-attachments';

alter table public.support_messages
  drop constraint if exists support_messages_attachment_type_check;

alter table public.support_messages
  add constraint support_messages_attachment_type_check
  check (attachment_type is null or attachment_type in ('image','video'));
