# Verified existing admin moderation integration points

Source inspected: `index.html` on `feature/xoxo-safety-reminder-beta` (blob `dc017c672fe62ca768d6a11ed81db3b9b9fa5d97`), 2026-10-24.

## Confirmed existing UI
- Admin tab: `data-admin-tab="moderation"`, button `switchXoxoAdminTab('moderation',this)` (around line 7919).
- Panel: `id="xoxoAdminModeration"`, heading **Message Moderation 💜** (around line 7941).
- Existing conversation search: `xmmConversationSearch`, `renderXoxoDmConversations()` and list `xmmConversationList` (around line 7949).
- Existing DM report form: `xoxoDmReportForm`, `xoxoDmReportReason`, `xoxoDmReportDetails` (around line 19470).
- Existing one-message report submission inserts into `direct_message_reports` with `message_id`, `reporter_id`, `reason`, `details`. It must remain intact.

## BETA integration strategy
1. Do **not** replace the existing single-message reporting flow or full conversation viewer.
2. Add a separate user action to report a conversation, with explicit selection of 1–20 evidence messages.
3. Use the new authenticated BETA submission entry point only after its server RPC is deployed and verified.
4. Surface new report metadata within the existing `xoxoAdminModeration` panel; link to its already available conversation viewer rather than building a duplicate.
5. Keep the new reports isolated from existing `direct_message_reports` rows until a reviewed server-side read endpoint and admin PIN authorization are ready.
6. Confirm the actual admin report-loading implementation and access gate before editing `index.html`; these selectors alone do not establish secure authorization.

## Not done
- No `index.html` modifications.
- No new Supabase tables/RPC or production changes.
- No claim that conversation reports are already visible in admin.
