-- Disposable PostgreSQL ONLY. Never run against Supabase production.
DO $guard$ BEGIN
 IF current_database() <> 'xoxo_reveal_linked_ci' OR current_user <> 'xoxo_test'
 THEN RAISE EXCEPTION 'Refusing non-test database'; END IF;
END $guard$;
DO $roles$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
END $roles$;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE
AS $fn$ SELECT current_setting('request.jwt.claim.role',true) $fn$;
CREATE TABLE public.xoxo_reveal_upload_attempts(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),sender_id uuid NOT NULL,recipient_id uuid NOT NULL,request_key text,payload_fingerprint text,claim_token uuid,status text NOT NULL,
 writer_state text,upload_uncertain_at timestamptz,reveal_id uuid,dm_id uuid,
 updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(sender_id,request_key));
CREATE TABLE public.xoxo_reveal_upload_objects(
 attempt_id uuid,sender_id uuid,bucket_id text,object_path text,payload_fingerprint text);
CREATE TABLE public.xoxo_reveal_quota_reservations(
 upload_attempt_id uuid,sender_id uuid,released_at timestamptz);
CREATE TABLE public.direct_messages(
 id uuid PRIMARY KEY,sender_id uuid,recipient_id uuid);
CREATE TABLE public.xoxo_reveals(
 id uuid PRIMARY KEY,dm_id uuid UNIQUE NOT NULL REFERENCES public.direct_messages(id),
 upload_attempt_id uuid,sender_id uuid,recipient_id uuid,object_path text UNIQUE,
 payload_fingerprint text,media_type text,mode text,duration_seconds integer);
CREATE TABLE public.user_blocks(blocker_id uuid,blocked_id uuid);
CREATE TABLE public.message_requests(sender_id uuid,recipient_id uuid,status text);
