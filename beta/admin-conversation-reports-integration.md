# Existing admin report integration — verified against index.html

## Verified implementation (2026-10-25)
The BETA branch's `index.html` (blob `dc017c672fe62ca768d6a11ed81db3b9b9fa5d97`) already implements:
- `loadXoxoDmReports()` calling `supabaseClient.rpc("get_xoxo_dm_reports")`.
- `renderXoxoDmReports()` populating existing `xmmReportsList` with report ID, reporter ID, reported user ID, reason, details, status and date.
- Status actions through `supabaseClient.rpc("update_xoxo_dm_report_status",{p_report_id,p_status})` for pending/reviewed/resolved/dismissed.
- `loadXoxoDmConversations()` calling `xoxo_admin_list_dm_conversations`; the admin already has a conversation viewer.
- Existing single-message user reporting via `direct_message_reports` with reason values harassment/spam/inappropriate/threats/other, and a recipient-only check in the UI.

## Integration decision
**Reuse `xmmReportsList`, the current moderator UI, existing conversation viewer, and verified PIN gate. No second admin page.**

The new BETA report schema is separate from `direct_message_reports`. Consequently, its rows will **not** automatically appear through `get_xoxo_dm_reports`. Do not claim that they do.

Before shipping, choose one reviewed server-side approach:
1. Extend the existing admin reports RPC to return a normalized UNION of old and new report types, with `report_type` discriminator and source-specific status updates; or
2. Add a separate admin-only BETA list RPC and merge both result sets in `loadXoxoDmReports()`, preserving the existing status RPC for legacy reports.

**Preferred:** second approach until compatibility with the existing RPC is verified, to avoid changing the established production contract.

## Required mapping for new reports
- `id`, `created_at`, `reporter_id`, `other_user_id AS reported_user_id`, `reason_code`, `details`, `status`, `evidence_count`, `report_type='conversation_beta'`.
- Do not pass `reason_code` directly to the legacy `xoxoDmReasonNames` mapping; add an explicit 0–5 translation table matching the report form.
- For new report status changes, do **not** call `update_xoxo_dm_report_status` until its authorization and table target are verified. Provide a separate vetted RPC if needed.
- Link new reports to the existing conversation viewer using the two participant IDs; never grant additional message read access from report metadata alone.

## Release blockers
- `xoxo_conversation_reports_beta` and evidence table do not yet exist in live Supabase.
- `xoxo_submit_conversation_report_beta` is not installed.
- No verified admin listing/status RPC for the new table.
- New user report form not yet wired to the submission entry point.
- Automated suites not yet verified as passing.
- Retention for deleted/temporary messages must be decided before promising evidence preservation.

No production SQL, code, or deployment changed by this document.
