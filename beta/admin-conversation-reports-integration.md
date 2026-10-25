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
