-- XOXO Reveal BETA — server-only reconciliation administrator verification.
-- REVIEW ONLY. DO NOT APPLY. Must confirm existing is_xoxo_admin()
-- signature and semantics in target database before deployment.
BEGIN;
CREATE OR REPLACE FUNCTION public.xoxo_reveal_is_reconciliation_admin_v1(
 p_user_id uuid
) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER
 SET search_path=''
AS $function$
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' OR p_user_id IS NULL
 THEN RETURN false; END IF;
 -- Existing is_xoxo_admin() must be independently verified before applying.
 -- This assumes a no-argument function checks auth.uid(), which is NOT
 -- appropriate for service_role acting on behalf of a separate user.
 -- Therefore deny until a verified, server-owned admin membership source
 -- is wired. Never infer admin status from client metadata.
 RETURN false;
END;
$function$;
REVOKE ALL ON FUNCTION public.xoxo_reveal_is_reconciliation_admin_v1(uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.xoxo_reveal_is_reconciliation_admin_v1(uuid)
 TO service_role;
COMMIT;
-- RELEASE BLOCKER: replace unconditional false with a validated privileged
-- admin membership lookup after inspecting actual production schema.
