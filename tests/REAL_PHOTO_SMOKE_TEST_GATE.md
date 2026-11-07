# XOXO Reveal — controlled real-photo test gate (BETA only)

**No live test has been run.** All previous end-to-end tests used mocked bytes and mocked RPC responses. Do not apply migrations or deploy Edge Functions on the live project without explicit approval.

## Preconditions for a genuine photo test
1. Provision an isolated test project or an approved isolated environment with the reviewed schema. A Git branch does not isolate a production database.
2. Review the two SQL drafts together. The prepare/start draft uses `open_session_id`, `session_expires_at` and `dm_id`, and must match the final schema exactly. Do not apply the older claim-open draft.
3. Build a scoped server-side upload endpoint; there is currently **no upload backend**. Confirm sender identity, accepted DM relationship, recipient, blocks, size, MIME sniffing and path ownership before any write.
4. Fix the media proxy's handling of Storage Range responses and verify Supabase Storage actually returns `206` and `Content-Range` for private objects. Confirm no entire-file refetch. Test OPTIONS preflight from the exact website origin.
5. Validate 5/10/15/20-second behavior on slow connections. Current timer begins at server START, before the image is downloaded. It does **not** guarantee the requested display duration after image load.
6. Verify expiry and once-mode access with two simultaneous devices, refresh, network interruption, repeated Range requests and revoked sessions.
7. Verify moderation retention and cleanup before enabling destructive deletion.
8. Record storage, Edge invocations, request count and egress with a single consented synthetic image. Stop if any unexpected usage or auth bypass appears.

## Proposed first smoke test (only after gates)
- Upload one generated 100–300 KiB WebP to a private test bucket via an authenticated scoped endpoint.
- Send a synthetic DM between two consenting test accounts.
- Assert an unauthorized user gets 403; recipient can prepare, start and fetch bounded image ranges; subsequent expired requests get 410.
- Confirm the viewer revokes its object URL and logs do not contain tokens or service-role secrets.
- Delete the synthetic artifact according to reviewed retention rules.

## Known release blockers
- No production-safe uploader.
- Storage range support and Safari behavior unverified.
- Image/video timing tradeoff unresolved.
- No real cross-device access tests.
- Production schema and endpoint have not been deployed.
