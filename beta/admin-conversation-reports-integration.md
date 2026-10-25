# Verified integration map — XOXO Avenue BETA

## Existing implementation (verified in branch index.html)
- Existing DM report overlay IDs: `xoxoDmReportOverlay`, `xoxoDmReportForm`, `xoxoDmReportReason`, `xoxoDmReportDetails`.
- Existing entry point: `window.openXoxoDmReport(messageId)`.
- Existing submit path: `supabaseClient.from('direct_message_reports').insert(...)` with `message_id`, `reporter_id`, `reason`, `details`.
- Existing report reason values: `harassment`, `spam`, `inappropriate`, `threats`, `other`.
- Existing report UI checks recipient of the selected message against current user.
- Existing admin moderation container: `#xoxoAdminModeration`; full DM moderation capability must be reused, not duplicated.
- The existing form reports **one received message**, while Stay Safe BETA reports a **conversation with 1–20 selected messages**. Do not change the semantics of the existing form.

## BETA integration design
1. Preserve `openXoxoDmReport` and `direct_message_reports` unchanged to avoid regressions.
2. Add a distinct conversation-report action near the DM conversation controls, using the BETA evidence picker and form; avoid naming collisions.
3. Submit through `submitConversationReportBeta` only after the reviewed atomic server RPC exists. No client-side direct INSERT for multi-message reports.
4. Integrate the new report records into the **existing** admin moderation workflow, linked by reporter/peer IDs; do not create another full-conversation viewer.
5. Show report reason, details, selected message references and status; do not give users access to other participants' conversations.
6. Map BETA six reason codes to stable server-defined semantics. Do not assume existing five text values can represent six codes.
7. Preserve existing admin PIN authorization and audit behavior; inspect real moderation fetch/authorization code before editing it.

## Verified constraints
- Current `direct_message_reports` is for one `message_id` and its unique reporter; it cannot store 1–20 evidence IDs atomically as a single report.
- `public.direct_messages` uses sender/recipient UUIDs rather than conversation_id.
- The proposed `xoxo_conversation_reports_beta` and `xoxo_conversation_report_evidence_beta` tables were not present at the last read-only database inspection.
- Expiring whispers and one-view media require separate evidence retention decisions.

## Next implementation gates
- Inspect exact admin moderation JS fetch paths and PIN enforcement.
- Build and verify server-side atomic persistence with idempotency, rate limits, RLS and retention.
- Connect new UI only on BETA after the persistence path is tested.
- Explicit authorization required before live Supabase DDL or production deployment.

Status: based on direct inspection of branch index.html. No live code or database changes.


## Verified existing implementation in index.html (read-only code audit)
- The existing report-message dialog writes directly to `public.direct_message_reports`, with `message_id`, `reporter_id`, `reason` and `details`. It currently checks that the reporter received the selected message. **Do not replace or break this existing flow.**
- The current reason values are `harassment`, `spam`, `inappropriate`, `threats`, `other`. The BETA conversation flow has six numeric reasons: an explicit, reviewed mapping is required; never silently coerce a sixth reason to `other`.
- Existing admin DM history uses `openXoxoDmConversation(c)`, verifies admin state, prompts for a moderation PIN and reason, and calls `xoxo_admin_read_dm_page_pin` with the two participant IDs. This is already the full-conversation viewer; **reuse it**.
- Existing report submission and full-conversation moderation are different code paths. Merely inserting a BETA conversation report will not automatically add it to the admin's existing report queue; its query/render path must be inspected before UI integration.
- Recommended BETA adapter: when a report is persisted, store both participant UUIDs and a report ID, then expose an authorized admin queue action that invokes the existing `openXoxoDmConversation` with the same participant pair. Do not introduce a new raw-DM SELECT endpoint.
- The new RPC and proposed BETA tables are still absent from the live database; this audit did not apply SQL or modify production.

## Verification note
Inspected the actual `index.html` blob `dc017c672fe62ca768d6a11ed81db3b9b9fa5d97` on the BETA branch. The file is about 5.1 MB, so edits to it should be small and carefully validated rather than rewriting blindly.
