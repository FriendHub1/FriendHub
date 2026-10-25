# Existing production admin DM reporting integration map (read-only audit)

Verified from `index.html` blob `dc017c672fe62ca768d6a11ed81db3b9b9fa5d97` on BETA branch.

## Already implemented
- Existing user-facing flag opens `openXoxoDmReport(messageId)`.
- Existing report submission inserts into `direct_message_reports` with `message_id`, `reporter_id`, `reason`, `details`; only recipient can submit according to current UI check.
- Admin moderation tab already loads `loadXoxoDmReports()` and `loadXoxoDmConversations()`.
- Reports list reads via `get_xoxo_dm_reports` RPC and renders in `xmmReportsList`.
- Report statuses change through `update_xoxo_dm_report_status` RPC.
- Full DM conversation list reads through `xoxo_admin_list_dm_conversations` RPC; existing history viewer is paginated.
- Moderation PIN UI calls `xoxo_moderation_pin_status` RPC; preserve existing server authorization.

## What is NOT implemented
- New multi-message report flow is not connected to the production `index.html`.
- `xoxo_submit_conversation_report_beta` RPC and BETA report tables do not exist in live database (last verified).
- Existing single-message report schema and UI are not equivalent to a 1–20 message evidence report.

## Integration decision
- Keep the existing full-conversation viewer and its moderation PIN, audit, and pagination.
- Do not replace `direct_message_reports`, `get_xoxo_dm_reports`, or `update_xoxo_dm_report_status`.
- Extend existing moderation reports list only after the new report backend is implemented, with a distinct type marker and a safe link to existing conversation viewer.
- Never assume a new BETA report will appear in the old RPC automatically.
- Server-side authorization and retention design are release blockers.

No code was deployed, and no database changes were applied.
