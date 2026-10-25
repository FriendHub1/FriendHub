# Conversation report BETA: trust boundaries

The browser evidence picker and `authenticatedReportPreflight` are **UX checks only**. They cannot authorize a report or an admin read. An attacker can skip browser code, modify the client or replay requests.

## Required server flow (not deployed)

1. Authenticate the incoming bearer token on each request using Supabase Auth. Never accept a `reporter_id` from request JSON.
2. Create a fresh Supabase client for the request, configured with the **user JWT** for RLS-protected evidence lookup. Never use service-role for the evidence visibility check.
3. Validate the reason code, details length, peer UUID, and 1–20 unique evidence UUIDs.
4. Requery evidence IDs from `direct_messages` and verify **all** belong to the exact sender/recipient pair, are visible under current RLS, and match the submitted IDs. Fail closed on errors.
5. Check any extra restrictions for disappearing media, whispers, cleared messages, blocks, and expired content. Do not accidentally preserve expired content as report evidence.
6. Store reports and snapshots only after authorization, in a transaction or equivalent atomic database operation. Use idempotency and rate limits. Do not trust text or attachment URLs supplied by the browser.
7. Make evidence visible only through the existing PIN-gated admin moderation authorization. Admin UI gating alone is not sufficient; enforce backend authorization and audit accesses.
8. Add retention and deletion policy, including what should happen to reported messages when a user clears a chat.

**Current state:** No report submission endpoint, transactional storage, or admin moderation integration exists. Do not expose the proposed BETA tables to clients or claim live reports work.
