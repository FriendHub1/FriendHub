-- Disposable PostgreSQL 16 fixture for REAL draft refund function.
-- ONLY run on xoxo_reveal_test_ci; no production data or secrets.
DO $guard$
BEGIN
 IF current_database() <> 'xoxo_reveal_test_ci'
 OR current_user <> 'xoxo_test' THEN
  RAISE EXCEPTION 'Wrong database or user';
 END IF;
END $guard$;
DO $roles$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
END $roles$;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE
AS $fn$ SELECT current_setting('request.jwt.claim.role',true) $fn$;
CREATE TABLE IF NOT EXISTS public.xoxo_reveal_upload_attempts(
 id uuid PRIMARY KEY,sender_id uuid NOT NULL,status text NOT NULL
);
CREATE TABLE IF NOT EXISTS public.xoxo_reveals(
 id uuid PRIMARY KEY,upload_attempt_id uuid
);
CREATE TABLE IF NOT EXISTS public.xoxo_reveal_quota_reservations(
 id uuid PRIMARY KEY,sender_id uuid NOT NULL,upload_attempt_id uuid,
 released_at timestamptz
);
