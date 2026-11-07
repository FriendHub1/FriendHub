-- XOXO Reveal BETA — REVIEW ONLY, DO NOT APPLY TO PRODUCTION
-- Designed to be additive and avoid altering legacy direct_messages and dm-media.
-- A separate private bucket and records isolate Reveal from existing attachments.
-- Upload and playback are disabled until a reviewed Edge Function and cleanup job exist.
BEGIN;

INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
VALUES ('xoxo-reveal','xoxo-reveal',false,15728640,
  ARRAY['image/jpeg','image/webp','image/png','video/mp4','video/webm'])
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.xoxo_reveals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dm_id uuid UNIQUE REFERENCES public.direct_messages(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id),
  recipient_id uuid NOT NULL REFERENCES auth.users(id),
  object_path text NOT NULL UNIQUE,
  media_type text NOT NULL CHECK (media_type IN ('image','video')),
  duration_seconds integer CHECK (duration_seconds IN (5,10,15,20)),
  mode text NOT NULL CHECK (mode IN ('once','timed','keep')),
  created_at timestamptz NOT NULL DEFAULT now(),
  opened_at timestamptz,
  expires_at timestamptz,
  consumed_at timestamptz,
  CHECK(sender_id <> recipient_id),
  CHECK((mode='timed' AND duration_seconds IS NOT NULL)
    OR (mode IN ('once','keep') AND duration_seconds IS NULL))
);

ALTER TABLE public.xoxo_reveals ENABLE ROW LEVEL SECURITY;
-- Do not create permissive direct client INSERT/UPDATE/SELECT policies.
-- Server functions will authorize each action using auth.uid(), existing DM
-- acceptance/block rules, and explicit recipient state.
-- No storage.objects SELECT policy: objects are inaccessible to clients until
-- the separate authenticated server media-delivery endpoint is implemented.
-- No storage.objects INSERT policy: uploads will require a scoped server action.
-- Deletion of expired objects needs a scheduled, rate-limited cleanup worker.

CREATE INDEX IF NOT EXISTS xoxo_reveals_recipient_created_idx
 ON public.xoxo_reveals(recipient_id,created_at DESC);
CREATE INDEX IF NOT EXISTS xoxo_reveals_expires_idx
 ON public.xoxo_reveals(expires_at) WHERE expires_at IS NOT NULL;

COMMIT;

-- Important: this file alone does not implement secure Reveal delivery.
-- Once-mode is a single viewing SESSION, not one HTTP request; range requests
-- for video and already-issued signed URLs need separate handling.
-- Never store service-role keys in the browser.
-- Migration must be reviewed for moderation/report retention and deployed
-- only after user approves production DB changes.
