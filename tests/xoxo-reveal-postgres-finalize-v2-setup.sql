-- Disposable CI-only schema sufficient to parse the actual finalize v2 draft.
DO $guard$ BEGIN
 IF current_database() <> 'xoxo_reveal_finalize_ci' OR current_user <> 'xoxo_test'
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
 id uuid PRIMARY KEY,sender_id uuid NOT NULL,claim_token uuid,
 status text NOT NULL,upload_uncertain_at timestamptz,writer_state text,
 payload_fingerprint text,reveal_id uuid,dm_id uuid,updated_at timestamptz
);
CREATE TABLE public.xoxo_reveals(
 id uuid PRIMARY KEY,dm_id uuid,upload_attempt_id uuid,
 sender_id uuid,recipient_id uuid,object_path text,payload_fingerprint text
);
CREATE TABLE public.direct_messages(id uuid PRIMARY KEY,sender_id uuid,recipient_id uuid);
CREATE TABLE public.user_blocks(blocker_id uuid,blocked_id uuid);
CREATE TABLE public.message_requests(sender_id uuid,recipient_id uuid,status text);
CREATE TABLE public.xoxo_reveal_upload_objects(
 attempt_id uuid,sender_id uuid,payload_fingerprint text,bucket_id text,object_path text
);
CREATE TABLE public.xoxo_reveal_quota_reservations(
 upload_attempt_id uuid,sender_id uuid,released_at timestamptz
);
