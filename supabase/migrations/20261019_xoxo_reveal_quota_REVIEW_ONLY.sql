-- XOXO Reveal BETA — REVIEW ONLY / DO NOT APPLY TO PRODUCTION.
-- Atomic per-user upload quota reservations. Requires security review before use.
-- Proposed limits: 120/hour, 600/day, 1200 MiB/hour.
CREATE TABLE IF NOT EXISTS public.xoxo_reveal_quota_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  byte_count bigint NOT NULL CHECK (byte_count > 0 AND byte_count <= 15728640),
  created_at timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz,
  CONSTRAINT xoxo_reveal_quota_release_after_create CHECK
    (released_at IS NULL OR released_at >= created_at)
);
CREATE INDEX IF NOT EXISTS xoxo_reveal_quota_sender_time
  ON public.xoxo_reveal_quota_reservations(sender_id,created_at DESC)
  WHERE released_at IS NULL;
ALTER TABLE public.xoxo_reveal_quota_reservations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.xoxo_reveal_quota_reservations FROM anon, authenticated;
-- No client policies: only trusted server-side SECURITY DEFINER RPC may reserve.

CREATE OR REPLACE FUNCTION public.xoxo_reveal_reserve_quota_v1(p_bytes bigint)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_sender uuid := auth.uid();
  v_hour_count bigint;
  v_day_count bigint;
  v_hour_bytes bigint;
  v_reservation uuid;
  v_now timestamptz := clock_timestamp();
BEGIN
  IF v_sender IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_bytes IS NULL OR p_bytes < 1 OR p_bytes > 15728640 THEN
    RAISE EXCEPTION 'Invalid upload size';
  END IF;
  -- Transaction-scoped lock serializes quota decisions for this user.
  PERFORM pg_advisory_xact_lock(hashtextextended(v_sender::text, 761921));
  SELECT count(*),coalesce(sum(byte_count),0)
    INTO v_hour_count,v_hour_bytes
    FROM public.xoxo_reveal_quota_reservations
   WHERE sender_id=v_sender AND released_at IS NULL
     AND created_at >= v_now - interval '1 hour';
  SELECT count(*) INTO v_day_count
    FROM public.xoxo_reveal_quota_reservations
   WHERE sender_id=v_sender AND released_at IS NULL
     AND created_at >= v_now - interval '1 day';
  IF v_hour_count >= 120 OR v_day_count >= 600 OR
     v_hour_bytes + p_bytes > 1200::bigint * 1024 * 1024 THEN
    RAISE EXCEPTION 'Reveal quota exceeded';
  END IF;
  INSERT INTO public.xoxo_reveal_quota_reservations(sender_id,byte_count)
  VALUES(v_sender,p_bytes) RETURNING id INTO v_reservation;
  RETURN v_reservation;
END;
$$;
REVOKE ALL ON FUNCTION public.xoxo_reveal_reserve_quota_v1(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.xoxo_reveal_reserve_quota_v1(bigint) TO authenticated;

-- Only trusted server credentials may refund. Browser users must never
-- be able to refund successful uploads to evade quotas.
CREATE OR REPLACE FUNCTION public.xoxo_reveal_release_quota_v1(
  p_reservation_id uuid, p_sender_id uuid
)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $
BEGIN
  IF p_reservation_id IS NULL OR p_sender_id IS NULL THEN
    RAISE EXCEPTION 'Missing reservation information';
  END IF;
  UPDATE public.xoxo_reveal_quota_reservations
     SET released_at=clock_timestamp()
   WHERE id=p_reservation_id AND sender_id=p_sender_id AND released_at IS NULL;
  RETURN FOUND;
END;
$;
REVOKE ALL ON FUNCTION public.xoxo_reveal_release_quota_v1(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.xoxo_reveal_release_quota_v1(uuid,uuid) TO service_role;
-- REVIEW BLOCKERS: lock namespace collisions, role/function ownership,
-- server refund authorization, retry/idempotency,
-- server-only access, retention cleanup, isolation, and billing caps.
-- DO NOT APPLY until both RPCs are independently audited.
