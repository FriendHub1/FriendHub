-- XOXO Reveal BETA — two-phase viewing, REVIEW ONLY / DO NOT APPLY.
-- Supersedes the earlier claim-open draft; do NOT deploy both RPCs.
-- Depends on xoxo_reveals table draft. No storage access is granted by these RPCs.
-- A future private delivery endpoint must validate preparation vs active phases.

BEGIN;
ALTER TABLE public.xoxo_reveals
  ADD COLUMN IF NOT EXISTS prepare_token uuid,
  ADD COLUMN IF NOT EXISTS prepared_at timestamptz,
  ADD COLUMN IF NOT EXISTS prepare_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS open_session_id uuid,
  ADD COLUMN IF NOT EXISTS session_expires_at timestamptz;

CREATE OR REPLACE FUNCTION public.xoxo_reveal_prepare_v1(p_reveal_id uuid)
RETURNS TABLE(preparation_id uuid, prepare_until timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp
AS $$
DECLARE v public.xoxo_reveals%ROWTYPE; t timestamptz:=clock_timestamp(); token uuid:=gen_random_uuid();
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v FROM public.xoxo_reveals WHERE id=p_reveal_id AND recipient_id=auth.uid() FOR UPDATE;
  IF NOT FOUND OR v.dm_id IS NULL OR NOT EXISTS(
    SELECT 1 FROM public.direct_messages dm
    WHERE dm.id=v.dm_id AND dm.sender_id=v.sender_id AND dm.recipient_id=v.recipient_id
  ) THEN RAISE EXCEPTION 'Reveal unavailable'; END IF;
  IF v.mode <> 'keep' AND (v.opened_at IS NOT NULL OR v.consumed_at IS NOT NULL)
    THEN RAISE EXCEPTION 'Reveal already opened'; END IF;
  -- Avoid multiple concurrent preparations; stale preparations can be replaced.
  IF v.prepare_expires_at > t AND v.prepare_token IS NOT NULL
    THEN RAISE EXCEPTION 'Reveal is being prepared'; END IF;
  UPDATE public.xoxo_reveals SET prepare_token=token, prepared_at=t,
    prepare_expires_at=t+interval '30 seconds', open_session_id=NULL,
    session_expires_at=NULL
  WHERE id=v.id;
  RETURN QUERY SELECT token,t+interval '30 seconds';
END; $$;

CREATE OR REPLACE FUNCTION public.xoxo_reveal_start_v1(p_reveal_id uuid,p_preparation_id uuid)
RETURNS TABLE(session_id uuid,active_until timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp
AS $$
DECLARE v public.xoxo_reveals%ROWTYPE; t timestamptz:=clock_timestamp();
  token uuid:=gen_random_uuid(); until_at timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v FROM public.xoxo_reveals WHERE id=p_reveal_id AND recipient_id=auth.uid() FOR UPDATE;
  IF NOT FOUND OR v.prepare_token IS DISTINCT FROM p_preparation_id OR
    v.prepare_expires_at IS NULL OR v.prepare_expires_at <= t
    THEN RAISE EXCEPTION 'Preparation expired or invalid'; END IF;
  IF v.dm_id IS NULL OR NOT EXISTS(
    SELECT 1 FROM public.direct_messages dm
    WHERE dm.id=v.dm_id AND dm.sender_id=v.sender_id AND dm.recipient_id=v.recipient_id
  ) THEN RAISE EXCEPTION 'Reveal unavailable'; END IF;
  IF v.mode <> 'keep' AND (v.opened_at IS NOT NULL OR v.consumed_at IS NOT NULL)
    THEN RAISE EXCEPTION 'Reveal already opened'; END IF;
  IF v.mode='timed' AND v.duration_seconds IN (5,10,15,20) THEN
    until_at:=t+make_interval(secs=>v.duration_seconds);
  ELSIF v.mode='once' THEN
    -- 60s safety ceiling, not a promise that user sees for 60s.
    until_at:=t+interval '60 seconds';
  ELSIF v.mode='keep' THEN
    until_at:=t+interval '5 minutes';
  ELSE RAISE EXCEPTION 'Invalid mode'; END IF;
  UPDATE public.xoxo_reveals SET
    prepare_token=NULL,prepare_expires_at=NULL,
    opened_at=CASE WHEN mode='keep' THEN coalesce(opened_at,t) ELSE t END,
    consumed_at=CASE WHEN mode='once' THEN t ELSE consumed_at END,
    expires_at=CASE WHEN mode='keep' THEN NULL ELSE until_at END,
    open_session_id=token,session_expires_at=until_at
  WHERE id=v.id;
  RETURN QUERY SELECT token,until_at;
END; $$;

REVOKE ALL ON FUNCTION public.xoxo_reveal_prepare_v1(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.xoxo_reveal_start_v1(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.xoxo_reveal_prepare_v1(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.xoxo_reveal_start_v1(uuid,uuid) TO authenticated;
COMMIT;

-- RELEASE BLOCKERS:
-- 1. The media endpoint must distinguish a bounded PREPARE fetch from active
--    viewing and MUST NOT leak media during slider motion. If the client can
--    fetch full media in PREPARE, a malicious client can keep it: cannot promise
--    strong one-time confidentiality or prevent screenshots/downloads.
-- 2. Video playback requires buffered data before start; choose between
--    limited preview buffering and strict start-before-first-byte semantics.
-- 3. If a once-mode PREPARE expires before START, it can be prepared again.
--    Product/security decision needed on whether preparation counts as viewing.
-- 4. Block/DM-deletion checks, per-user rate limiting, reporting retention,
--    video range requests, and client UI tests required before deployment.
-- 5. Cleanup must not delete while active session exists.
