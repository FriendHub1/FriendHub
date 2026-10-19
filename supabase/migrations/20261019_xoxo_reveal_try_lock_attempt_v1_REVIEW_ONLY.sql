-- XOXO Reveal BETA — REVIEW ONLY. NEVER APPLY TO PRODUCTION.
-- Transaction-scoped attempt lock; NOT a cross-service Storage writer fence.
-- A worker must also persist writer state and wait for in-flight Storage writes.
CREATE OR REPLACE FUNCTION public.xoxo_reveal_try_lock_attempt_v1(
 p_attempt_id uuid, p_sender_id uuid
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $function$
DECLARE v_attempt_id uuid;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN
  RAISE EXCEPTION 'Unauthorized';
 END IF;
 IF p_attempt_id IS NULL OR p_sender_id IS NULL THEN
  RAISE EXCEPTION 'Invalid attempt';
 END IF;
 -- NOWAIT fails rather than blocking another transaction.
 BEGIN
  SELECT id INTO v_attempt_id
  FROM public.xoxo_reveal_upload_attempts
  WHERE id=p_attempt_id AND sender_id=p_sender_id
  FOR UPDATE NOWAIT;
 EXCEPTION WHEN lock_not_available THEN
  RETURN false;
 END;
 RETURN v_attempt_id IS NOT NULL;
END $function$;
REVOKE ALL ON FUNCTION public.xoxo_reveal_try_lock_attempt_v1(uuid,uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.xoxo_reveal_try_lock_attempt_v1(uuid,uuid)
 TO service_role;
-- Calling this outside a transaction releases its row lock immediately.
-- No Storage absence/refund authority is granted by this function.
