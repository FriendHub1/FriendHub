-- Disposable PostgreSQL quota CI database only.
DO $guard$
BEGIN
 IF current_database() <> 'xoxo_reveal_quota_ci' OR current_user <> 'xoxo_test'
 THEN RAISE EXCEPTION 'Refusing to test outside disposable quota CI database'; END IF;
END $guard$;
DO $test$
DECLARE
 v_fn oid := 'public.xoxo_reveal_release_quota_v1(uuid,uuid)'::regprocedure;
BEGIN
 -- PUBLIC is a PostgreSQL pseudo-role, not a pg_roles entry.
 -- A null grantee in pg_proc.proacl represents a grant to PUBLIC.
 IF EXISTS (
  SELECT 1
    FROM pg_proc p
    CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) acl
   WHERE p.oid=v_fn AND acl.grantee=0 AND acl.privilege_type='EXECUTE'
 ) THEN
  RAISE EXCEPTION 'PUBLIC must not execute quota refund';
 END IF;
 IF has_function_privilege('anon',v_fn,'EXECUTE') THEN
  RAISE EXCEPTION 'anon must not execute quota refund';
 END IF;
 IF has_function_privilege('authenticated',v_fn,'EXECUTE') THEN
  RAISE EXCEPTION 'authenticated must not execute quota refund';
 END IF;
 IF NOT has_function_privilege('service_role',v_fn,'EXECUTE') THEN
  RAISE EXCEPTION 'service_role must be allowed to execute quota refund';
 END IF;
END $test$;
