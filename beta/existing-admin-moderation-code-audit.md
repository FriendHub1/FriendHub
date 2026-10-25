# Verified integration points in index.html (BETA)

Source inspected: index.html blob dc017c672fe62ca768d6a11ed81db3b9b9fa5d97. This is a code audit, not a deployment.

## Existing report submission
- Existing dialog: xoxoDmReportOverlay, form xoxoDmReportForm, reason selector xoxoDmReportReason.
- Existing entry point: window.openXoxoDmReport(messageId).
- It currently checks that the selected message is **received** by currentUser, then inserts one record into public.direct_message_reports.
- Existing reason values: harassment, spam, inappropriate, threats, other.
- Existing details limit: 1000 characters.
- Existing unique constraint returns error 23505 for repeated message reports.
- This existing single-message report flow MUST remain working. The proposed conversation report is a distinct 1–20 evidence flow, not a silent replacement.

## Existing administrator conversation viewer
- Existing entry point: openXoxoDmConversation(c).
- Guard: xoxoIsAdmin, then xoxoModerationPinAuthorize(es).
- PIN verification RPC: xoxo_moderation_pin_verify.
- Protected read RPC: xoxo_admin_read_dm_page_pin, with p_user_1, p_user_2, p_reason, p_before_at and p_before_id.
- Existing viewer target: xmmMessages. It already renders full DM conversation history.
- Do not build a second viewer. A new report row can link to the existing conversation by its two participants, provided the admin's existing PIN flow is used.

## Compatibility risks to resolve before connecting UI
1. Existing reports are recipient-only single-message reports; new reports may include both sent and received messages. Do not force new reports through the old INSERT endpoint.
2. Existing reason codes are strings, new reason codes are integers 0–5; define an explicit mapping and translations.
3. Existing form allows 1000 characters, new design 2000; avoid changing old form behavior accidentally.
4. Never infer that xoxoIsAdmin client-side flag alone authorizes reading new report data.
5. Existing admin viewer reads full conversations through a PIN-protected RPC. The new report submission endpoint must **not** grant any similar privilege.
6. New report listing/notification must use a server-authorized query and link into openXoxoDmConversation(c) with correct user_1/user_2; do not assume its parameter shape beyond the observed fields.

## Next executable implementation work
- Review existing report queue UI and its backend queries.
- Implement audited server-side persistence for xoxo_conversation_reports_beta and selected evidence.
- Add the new report item to the existing queue and route its action to openXoxoDmConversation(c).
- Test existing single-message reports and new conversation reports with two test accounts and the admin.

Production, Supabase schema and index.html remain unchanged by this document.
