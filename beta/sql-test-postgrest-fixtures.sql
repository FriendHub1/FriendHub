-- Ephemeral HTTP integration fixtures; run after the original SQL+concurrency tests.
-- Only the xoxo_safety_test disposable database on 127.0.0.1 may execute this.
\set ON_ERROR_STOP on

do $xoxo_http_fixture_check$
begin
  if current_database() <> 'xoxo_safety_test' then
    raise exception 'Never run this HTTP test fixture on non-CI databases';
  end if;
end $xoxo_http_fixture_check$;

insert into auth.sessions(id, user_id, not_after) values
 ('aaaa0000-0000-4000-8000-000000000001','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',null),
 ('bbbb0000-0000-4000-8000-000000000002','ffffffff-ffff-4fff-8fff-ffffffffffff',null),
 ('cccc0000-0000-4000-8000-000000000003','99999999-8888-4777-8666-555555555555',null);

insert into public.direct_messages(id, sender_id, recipient_id, content, created_at) values
 ('88888888-8888-4888-8888-888888888881',
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  'ffffffff-ffff-4fff-8fff-ffffffffffff',
  'A private HTTP-only evidence message',now()),
 ('88888888-8888-4888-8888-888888888882',
  'ffffffff-ffff-4fff-8fff-ffffffffffff',
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  'The second legitimate message',now());
-- An outsider has no permission to read either direct message via PostgREST.
-- Re-enable a verified PIN for the separately authenticated admin test user.
update public.xoxo_moderation_pin_security
   set verified_until = now() + interval '10 minutes', locked_until = null
 where admin_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
