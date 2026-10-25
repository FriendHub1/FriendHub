# Verified admin moderation integration map (source: index.html BETA branch)

Inspected the real 5.1 MB index.html blob (dc017c672fe62ca768d6a11ed81db3b9b9fa5d97), not a mockup.

## Already implemented in the site
- Existing user report modal: `openXoxoDmReport(messageId)`, `xoxoDmReportForm`; inserts into `direct_message_reports`. It reports **one received message**, not a conversation. Preserve this behavior.
- Existing admin report queue: `loadXoxoDmReports()` calls `get_xoxo_dm_reports`; `renderXoxoDmReports()` renders cards into `#xmmReportsList`. Status actions call `update_xoxo_dm_report_status`.
- Existing admin full conversation viewer: `openXoxoDmConversation(c)` obtains authorization via `xoxoModerationPinAuthorize` and calls audited `xoxo_admin_read_dm_page_pin`. Preserve it unchanged.
- Existing admin moderation markup includes `#xmmReportsList` and a refresh button. No second conversation viewer needed.

## Integration decision
1. Keep `direct_message_reports` and its existing single-message modal and RPCs unchanged.
2. After the new atomic conversation-report RPC exists, extend the **existing** `loadXoxoDmReports` path to fetch both report types and render tagged cards in the same `#xmmReportsList`.
3. New cards must show reporter, reported peer, reason, status and evidence count; linking to the existing conversation viewer must still require `xoxoModerationPinAuthorize`.
4. New report status updates need a separate, server-authorized RPC (do **not** send new report IDs to `update_xoxo_dm_report_status`).
5. Preserve old queue if the new endpoint fails; display a partial-load notice, never erase legacy reports.
6. Admin queue endpoints must verify admin permissions server-side; no public SELECT access.
7. Do not present new reports as available until the storage RPC and admin queue RPC actually exist.

## Current gaps
- `xoxo_submit_conversation_report_beta` RPC and proposed tables not installed.
- No admin RPC to list conversation reports or update their statuses.
- No new frontend conversation-report form integrated into `index.html`.
- Tests and end-to-end behavior still need verification.

No production change was made by this documentation.
