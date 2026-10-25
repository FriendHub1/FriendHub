# Reuse existing DM moderation — BETA integration contract

## Existing behavior confirmed by site owner
- The current admin panel already provides access to full DM conversations for moderation.
- **Do not build a duplicate full-conversation viewer or replace existing moderation.**
- Preserve existing reports, admin controls, moderation PIN, message history and workflows.
- New conversation reports should appear in the existing moderation/reporting workflow, with a clear report reason, reporter, reported participant and the selected evidence IDs.

## Important distinction
- The **report submission** includes only 1–20 explicitly selected messages as evidence.
- The admin's **existing full-conversation moderation access** is a separate pre-existing feature; it must retain its current server authorization and audit protections.
- Do not broaden access for ordinary users or expose full conversations through the new report endpoint.
- Reuse the existing panel's verified admin authorization and PIN gate; do not implement UI-only privilege checks.
- Whether the current panel already shows all *reports* (as opposed to full conversations) must be checked in index.html before deciding where to place the new report entry.

## Implementation plan
1. Inspect current admin DM moderation/report UI and its database queries.
2. Add a report record or adapter compatible with that UI without breaking direct_message_reports.
3. Route the report notification into the existing admin workflow, linking to the relevant conversation.
4. Verify status changes and audit logs using test accounts.
5. Preserve deleted/expiring evidence only under an explicitly reviewed retention policy.

## Release gate
- Confirm no duplicate moderation page and no regression to existing full DM viewer.
- Confirm new report only becomes visible after successful atomic server persistence.
- Confirm non-admins cannot access the moderation viewer or report metadata.
- Do not deploy or change live Supabase without explicit authorization.

Status: design contract updated to match owner feedback; no live implementation or deployment.

## Verified against actual index.html on 2026-10-24
- Inspected GitHub blob dc017c672fe62ca768d6a11ed81db3b9b9fa5d97 (the large index.html; regular fetch_file returned empty content).
- Existing admin conversation moderation viewer uses CSS classes beginning `xmm-` and provides a conversation-style, read-only message display.
- Existing moderation PIN prompt requests a six-digit PIN **and a reason for moderation**; preserve this gate and its server-side verification.
- Existing `openXoxoDmReport(messageId)` is for a **single received message**. It checks the selected message belongs to the current recipient, and submits to `public.direct_message_reports` with `message_id`, `reporter_id`, `reason`, `details`.
- Existing single-message report reason values are `harassment`, `spam`, `inappropriate`, `threats`, `other`, with a 1000-character details field. This differs from the proposed BETA conversation report's numeric 0–5 reason codes and 2000-character details.
- **Do not silently replace the existing single-message reporting flow** or map numeric reasons to existing reason strings without a reviewed compatibility mapping.
- The existing single-message report UI confirms only a selected message; the proposed conversation report must be an additional path, not an implicit change to existing reports.
- The admin conversation viewer exists, but this inspection does not establish that it currently displays the new BETA report records. That linkage is still unimplemented.

### Concrete next integration step
Inspect the admin viewer's exact query/open functions and choose a safe route to the existing conversation using the reported user pair. Keep report metadata and evidence access under server-verified admin authorization and audit logging. Never add unrestricted report-table SELECT policies.

## Draft backend integration — 2026-10-25

Review-only SQL: `beta/stay-safe-conversation-reports-schema.sql`. **Not deployed to Supabase.**

- Private reporting and evidence tables with RLS enabled and no direct authenticated-user table grants.
- `xoxo_submit_conversation_report_beta`: validates the authenticated reporter, 1–20 distinct messages, pair membership and `dm_conversation_clears` visibility; enforces idempotency and a proposed limit of 10 reports per 24h; atomically writes report and selected evidence metadata.
- `xoxo_admin_list_conversation_reports_beta`: returns up to 100 report metadata rows after verifying existing admin status and the moderation PIN session. It does not return full message content or replace the DM viewer.
- `xoxo_admin_update_conversation_report_beta`: accepts the four existing moderation statuses with admin/PIN checks and logs a status change in `xoxo_message_access_log`.
- The existing individual-message reports and their functions remain unchanged. The existing DM viewer retains its PIN + reason requirement and access logging.
- Evidence holds message IDs, sender, recipient and timestamps; no content/media snapshots. Physically deleted messages may no longer be readable in the existing viewer. Confirm retention policy before enabling.
- `beta/test-conversation-report-sql-contract.cjs` adds static source checks only; no SQL execution or authenticated end-to-end testing has been performed.

Next: complete review of SQL against a test database; verify authenticated and unauthorized roles; connect the existing admin reports area to metadata and open reported participant pairs through the current audited viewer. Review proposed rate limit, evidence retention and all 10 language translations before release.
