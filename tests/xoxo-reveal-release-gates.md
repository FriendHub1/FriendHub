# XOXO Reveal BETA — test plan and release blockers

This is a **test specification**, not evidence that tests have passed. No production changes.

## Blocking issues found during code review

1. `xoxo-reveal-media` currently calls `admin.storage.download()` for every request and materializes the whole Blob. A video player making multiple Range requests can repeatedly fetch the **entire video** from Storage, raising egress and Edge Function usage. Do not deploy until changed to a genuinely range-aware streaming path, or use a bounded alternative with measured costs.
2. The delivery endpoint checks a session before reading Storage, but a session may expire while bytes are already being delivered. Once bytes reach the device they cannot be remotely erased. Communicate this limit honestly.
3. The current open-claim SQL starts the server timer immediately on claim, not after image load or video play. That conflicts with approved UX. Implement a separate short-lived preparation grant followed by an atomic start event, or revise UX with explicit approval.
4. Current endpoint uses a bearer token in an Authorization header; native `<video src>` cannot set that header. A fetch/blob approach adds memory and transfer overhead and does not handle all video seeking well. Need an authenticated streaming approach compatible with Safari.
5. Media access is currently not rate limited. Add limits for per-user open attempts, bytes, upload frequency, and concurrent sessions.
6. Migration drafts must not be applied until normal DM attachment access, moderation, reporting, storage policies and retention are tested.
7. The draft upload preparation module currently limits video size/duration but does not transcode video; camera recordings may use MIME types not supported by the planned private bucket.
8. The Edge Function's Origin comparison is only an extra browser restriction, not authentication; test allowed web and mobile contexts.

## Acceptance tests

| ID | Scenario | Expected |
| --- | --- | --- |
| A01 | Anonymous request | 401 |
| A02 | Other authenticated user | 403 |
| A03 | Wrong reveal ID or session ID | 400/403 |
| A04 | Recipient before slider reaches 100% | No media request |
| A05 | Recipient after authorized claim | Authorized media only |
| A06 | Once, second open | Rejected atomically |
| A07 | Timed 5/10/15/20s | Server rejects subsequent requests after expiry |
| A08 | Two concurrent opens | At most one valid one-time session |
| A09 | Video Range requests | Correct bytes and no full-file Storage refetch per range |
| A10 | Large media upload | Rejected before upload |
| A11 | Compressed photo | Upload size <= 900 KiB |
| A12 | Regular DM attachments | Unchanged |
| A13 | User blocked or conversation deleted | No new authorized Reveal |
| A14 | iPhone Safari video | Plays without leaked public URL |
| A15 | Media expired during request | No new access; limits on in-flight bytes documented |
| A16 | Cleanup dry run | No deletions |
| A17 | Cleanup real run after approval | Deletes only expired objects with audit trail |
| A18 | Bandwidth benchmark | Compare Storage and Edge egress for 10 images + 10 videos |
| A19 | Admin moderation | Reported media retention follows approved policy |
| A20 | Refresh/reopen | No bypass of once or timed expiration |

## Release gates

- Security and bandwidth issues above resolved in branch.
- Tests executed in a controlled environment and results recorded (not just checklist).
- User explicitly approves production database changes and rollout.
- No merge to main, no deploy to Cloudflare, no active Supabase migrations until approval.
