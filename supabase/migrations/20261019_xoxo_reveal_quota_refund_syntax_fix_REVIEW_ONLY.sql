-- XOXO Reveal BETA — QUOTA SYNTAX FIX PROPOSAL ONLY.
-- DO NOT APPLY. This is a standalone replacement for the broken refund RPC
-- in 20261019_xoxo_reveal_quota_REVIEW_ONLY.sql.
-- Must be reviewed with the full quota schema before isolated execution.
CREATE OR REPLACE FUNCTION public.xoxo_reveal_release_quota_v1(
  p_reservation_id uuid, p_sender_id uuid
)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Server authorization required';
  END IF;
  IF p_reservation_id IS NULL OR p_sender_id IS NULL THEN
    RAISE EXCEPTION 'Missing reservation information';
  END IF;
  UPDATE public.xoxo_reveal_quota_reservations
    SET released_at = clock_timestamp()
    WHERE id = p_reservation_id
      AND sender_id = p_sender_id
      AND released_at IS NULL;
  RETURN FOUND;
END;
$function$;
REVOKE ALL ON FUNCTION public.xoxo_reveal_release_quota_v1(uuid,uuid)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.xoxo_reveal_release_quota_v1(uuid,uuid)
  TO service_role;
-- WARNING: even with valid dollar quoting, this is NOT a complete safe
-- refund implementation. The caller must verify the reservation belongs
-- to the exact attempt and that no successful/uncertain upload consumed it.
-- Never let the browser trigger refunds or supply trusted sender identity.
