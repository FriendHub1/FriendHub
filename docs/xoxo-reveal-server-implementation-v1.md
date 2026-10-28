# XOXO Reveal — server-side implementation plan and regression tests

**STATUS: DESIGN ONLY. Not deployed.** Existing production DM code, policies and functions remain unchanged.

## Verified existing function: `public.open_dm_ephemeral_media(message_id uuid)`
Current implementation performs an UPDATE on `direct_messages` for the recipient, image/video and mode `timed` or `once`, sets `media_opened_at = coalesce(media_opened_at,now())`, and returns timestamp. It allows repeat invocation when `media_opened_by = auth.uid()`, including `once` mode. It does not reject a timed item after `media_opened_at + media_view_seconds`.

Current `can_view_dm_media(object_name)` only checks DM participant and attachment path. It does not check expiration.

## Safe design for a later approved migration

Do not modify the existing open RPC in place until existing clients are audited; it might be used by current ephemeral DM functionality.

Introduce versioned API `xoxo_reveal_open_v1(message_id uuid)` with a **separate, explicit delivery state**. The atomic transaction must:
- require authenticated recipient of a DM and correct image/video attachment type;
- reject non-Reveal normal DM attachments and already-consumed `once` records;
- use row locking / conditional update to make a one-time transition atomic;
- enforce server timestamps for `timed` expiration;
- return **no storage path or signed URL** until authorization succeeds.

Storage access:
- Existing `dm-media` participant policy is insufficient for Reveal privacy.
- Use a dedicated **private** Reveal bucket and separate authorization path, so legacy DM attachments remain unaffected.
- A server-side Edge Function verifies recipient and active grant, then streams content or issues a narrowly scoped, short-lived URL. A URL already issued cannot be reliably revoked before TTL; do not claim perfect immediate revocation.
- Avoid persistent browser cache and prevent previews or fetches before the slider reaches 100%.
- For `once` mode, decide semantics precisely: one successful opening session, not one HTTP byte-range request; streaming videos may require multiple range requests.
- Cleanup expired objects asynchronously and handle failed uploads and aborted opens.
- Keep mode is explicitly persistent, with clear retention policy.
- Existing admin moderation must remain available through a separately audited and logged path; never bypass recipient controls silently.

## Regression tests required before any deployment
1. Sender cannot open recipient-only reveal.
2. Unrelated user cannot list, sign, fetch or download the object.
3. Recipient cannot fetch media before 100% slider and authorized open.
4. Once opens only in one authorized viewing session; second open rejected even after refresh.
5. Timed 5/10/15/20 seconds rejects new access after server expiry; expired URLs/caches addressed and documented.
6. Concurrent open calls do not yield multiple sessions.
7. Image timer starts after load; video timer after playback begins.
8. Normal DM text and legacy attachments work unchanged.
9. Recipient offline notification contains no photo/video preview or access token.
10. Moderation, blocking, reports, and deleted conversations behave correctly.
11. Test two non-admin accounts, desktop and iPhone Safari, camera/gallery/video.
12. Check storage usage, file-size limits and cost before enabling uploads.

## Decisions before implementation
- Verify live client usage of `open_dm_ephemeral_media` and existing ephemeral media UI.
- Confirm whether new dedicated private bucket and new table are permitted.
- Confirm policy for content retention, reports, and moderator access.
- Obtain explicit user approval for **production Supabase migrations and deployment** after review.

## Audit date
2026-10-19. Based on read-only queries of actual Supabase schema and function definitions.
