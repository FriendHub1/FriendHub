-- ONLY for a fresh disposable PostgreSQL CI database; never run on live Supabase.
\set ON_ERROR_STOP on
create table auth.users (id uuid primary key);
insert into auth.users(id) values
 ('11111111-1111-4111-8111-111111111111'),
 ('22222222-2222-4222-8222-222222222222'),
 ('33333333-3333-4333-8333-333333333333')
on conflict do nothing;
