# Actual admin DM reporting hooks (source inspection)

Read from BETA index.html blob dc017c672fe62ca768d6a11ed81db3b9b9fa5d97.

## Existing DM report submission
- The user-facing DM report overlay submits to `public.direct_message_reports`.
- Payload: `message_id`, `reporter_id`, `reason`, `details`.
- Current report UI allows recipient to report one selected message and uses existing reasons harassment/spam/inappropriate/threats/other.
- The current feature should remain unchanged until the conversation-report backend is verified.

## Existing admin moderation UI
- The **existing** reports container is `#xmmReportsList`, rendered by `renderXoxoDmReports()`.
- `loadXoxoDmReports()` fetches reports via `supabaseClient.rpc("get_xoxo_dm_reports")`.
- Status updates use `supabaseClient.rpc("update_xoxo_dm_report_status",{p_report_id,p_status})`.
- Admin name display uses `xoxoDmAdminName(id)`.
- Moderation panel is `#xoxoAdminModeration`; full DM viewer is a separate existing feature.
- Statistics query `get_xoxo_reported_conversations_count` is also already present.

## Compatibility decision
The new BETA conversation-report RPC `xoxo_submit_conversation_report_beta` does **not** automatically feed `get_xoxo_dm_reports`. Without server integration, new reports will NOT appear in the current admin report list. Do not imply otherwise.

Prefer extending the **existing server-side report retrieval and status RPCs**, or adding a safe normalized adapter at the admin report list, rather than creating a second moderation page. Preserve legacy `direct_message_reports` and existing statuses. Ensure that the new report's peer identity, reason and selected evidence can be shown while keeping existing conversation-view authorization independent.

## Follow-up implementation gates
1. Read current `get_xoxo_dm_reports` and `update_xoxo_dm_report_status` definitions in Supabase before proposing compatible SQL.
2. Define normalized record shape for both report types and avoid ID collision/ambiguous status updates.
3. Implement vetted submission, queue retrieval, status updates and audit on BETA.
4. Validate with admin and two test accounts before any live rollout.

No changes to production, schema, or admin HTML were made by this inspection.
