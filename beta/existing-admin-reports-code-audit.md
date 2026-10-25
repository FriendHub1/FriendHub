# Existing admin DM reports: code inspection (2026-10-24)

Inspected the actual BETA branch index.html Git blob `dc017c672fe62ca768d6a11ed81db3b9b9fa5d97` (read-only).

## Already present in index.html
- Admin panel `#xoxoAdminModeration` titled **Message Moderation 💜**.
- Existing `#xmmReportedConversations` count and `#xmmReportsList` under **🚩 Message Reports**.
- Existing **Refresh reports** action invokes `loadXoxoDmReports()`.
- Existing full-conversation moderation viewer `#xmmConversationList`, `#xmmMessages`, `loadXoxoDmConversations()`.
- Existing moderation UI explicitly requires a reason and secure PIN for opening conversations, and states that accesses are audited; server-side enforcement must still be verified.
- Existing single-message report dialog `#xoxoDmReportOverlay` uses `openXoxoDmReport(messageId)`, `#xoxoDmReportReason`, `#xoxoDmReportDetails`; inserts into `direct_message_reports` with `message_id`, `reporter_id`, `reason`, `details`.
- Existing report reason values: `harassment`, `spam`, `inappropriate`, `threats`, `other`.

## Critical compatibility observations
- The proposed new conversation report reasons are numeric codes 0–5, while existing reports use five named reason strings. Define an explicit label mapping before rendering; do not cast numeric reasons into existing enums.
- Existing `direct_message_reports` is message-level and has a unique reporter/message constraint. Do not insert 1–20 evidence rows as 1–20 independent user reports: that would corrupt report counts and statuses.
- Existing `loadXoxoDmReports()` must be inspected before adapting the queue. Prefer combining two authorized sources in the same UI while keeping their report identities distinct.
- The new BETA submission RPC is not deployed; adding UI calls before server deployment would create broken reports.
- The current full-conversation viewer is separate from selected evidence and must remain unchanged.

## Next implementation sequence
1. Read `loadXoxoDmReports()` and report-rendering logic to identify the minimum safe UI extension.
2. Define an authorized admin list/detail RPC for the new report table and selected evidence.
3. Integrate new report records into `#xmmReportsList` without replacing existing records.
4. Test moderation PIN, audit, counts, translations, old reports and new reports.

No production or Supabase changes made.
