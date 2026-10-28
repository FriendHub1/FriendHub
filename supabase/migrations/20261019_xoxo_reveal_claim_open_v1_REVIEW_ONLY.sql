-- XOXO Reveal BETA — REVIEW ONLY / DO NOT RUN YET
-- Requires 20261019_xoxo_reveal_beta_REVIEW_ONLY.sql.
-- Versioned atomic open-claim; deliberately returns NO media path or signed URL.
-- Server-only delivery endpoint must validate the claim before serving media.
BEGIN;

ALTER TABLE public.xoxo_reveals
  ADD COLUMN IF NOT EXISTS open_session_id uuid,
  ADD COLUMN IF NOT EXISTS session_expires_at timestamptz;

CREATE OR REPLACE FUNCTION public.xoxo_reveal_claim_open_v1(p_reveal_id uuid)
RETURNS TABLE(session_id uuid, active_until timestamptz, reveal_mode text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v public.xoxo_reveals%ROWTYPE;
  v_now timestamptz := clock_timestamp();
  v_until timestamptz;
  v_session uuid := gen_random_uuid();
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v FROM public.xoxo_reveals
  WHERE id = p_reveal_id AND recipient_id = auth.uid()
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reveal unavailable'; END IF;
  IF v.dm_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.direct_messages dm
    WHERE dm.id=v.dm_id AND dm.sender_id=v.sender_id AND dm.recipient_id=v.recipient_id
  ) THEN RAISE EXCEPTION 'Reveal unavailable'; END IF;

  IF v.mode = 'once' THEN
    IF v.opened_at IS NOT NULL OR v.consumed_at IS NOT NULL THEN
      RAISE EXCEPTION 'Reveal already opened';
    END IF;
    -- One viewing session; 60-second hard session cap is a safety bound.
    v_until := v_now + interval '60 seconds';
  ELSIF v.mode = 'timed' THEN
    IF v.opened_at IS NOT NULL THEN RAISE EXCEPTION 'Reveal already opened'; END IF;
    IF v.duration_seconds NOT IN (5,10,15,20) THEN RAISE EXCEPTION 'Invalid duration'; END IF;
    v_until := v_now + make_interval(secs => v.duration_seconds);
  ELSIF v.mode = 'keep' THEN
    -- Keep mode can be opened multiple times; each claim creates a new session.
    v_until := v_now + interval '5 minutes';
  ELSE
    RAISE EXCEPTION 'Invalid Reveal mode';
  END IF;

  UPDATE public.xoxo_reveals
  SET opened_at=CASE WHEN mode='keep' THEN coalesce(opened_at,v_now) ELSE v_now END,
      expires_at=CASE WHEN mode='keep' THEN NULL ELSE v_until END,
      consumed_at=CASE WHEN mode='once' THEN v_now ELSE consumed_at END,
      open_session_id=v_session,
      session_expires_at=v_until
  WHERE id=v.id;

  RETURN QUERY SELECT v_session,v_until,v.mode;
END;
$$;

REVOKE ALL ON FUNCTION public.xoxo_reveal_claim_open_v1(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.xoxo_reveal_claim_open_v1(uuid) TO authenticated;
COMMIT;

-- SECURITY NOTE: Claim alone does NOT grant access to media.
-- A separately authenticated delivery endpoint must verify reveal ID,
-- recipient ID, open_session_id and session_expires_at, and enforce access
-- for EACH request; do not issue long-lived signed URLs.
-- A claim begins the server clock immediately, NOT after media load/play.
-- Resolve this UX/security tradeoff before production launch.
-- Legacy direct_messages / dm-media functions remain untouched.
