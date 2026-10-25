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

## Verified opt-in preview paths (2026-10-25)

The BETA \`worker.js\` already has **separate workers.dev-only opt-in routes**.
No change to the production \`index.html\` was applied (the 5.1 MB HTML file
is too large for the current connector update channel).

### DM safety UI — canonical opt-in preview
- The workers.dev-only query /?xoxo_safety_chat_beta=1 loads the warning, form and evidence picker, followed by stay-safe-browser-report-adapter.js, stay-safe-browser-flow.js and stay-safe-chat-preview-bridge.js.
- The preview bridge delegates all form, evidence and submission state to the SAME canonical browser flow planned for final release. The previously duplicated submission logic in the preview bridge is gone.
- The canonical flow uses previewOnly=true and enabled=false. Users can interact with the entire example, but every attempt to submit returns a visible NOT SENT message without auth, message reads or RPC calls.
- No live Supabase data is written. No direct-message viewer or admin panel is duplicated.
- All ten XOXO languages are supported: en, es, pt-BR, fr, pl, de, cs, no, sv, it.
- Automated tests now include test-chat-canonical-preview.cjs, test-chat-preview-safe-mode.cjs and test-safety-ten-languages.cjs. The new canonical-preview test verifies zero reads, auth or RPC calls.
- stay-safe-index-hooks.js remains an unused future integration prototype; it should not be loaded beside the canonical host.

### Existing admin panel
- \`/?xoxo_safety_admin_beta=1\` injects
  \`admin-report-queue.js\` and \`admin-report-panel-bridge.js\`.
- That bridge hooks the *existing* \`loadXoxoDmReports\` panel and uses the
  existing \`openXoxoDmConversation\` read-only viewer, which requires PIN
  verification, moderation reason, and audit logging.
- New conversation reports do not appear until the audited backend RPC
  exists. Existing individual-message reporting is unaffected.
- \`stay-safe-admin-reports-bridge.js\` is a separate draft adapter, **not**
  loaded by this route. Retain only one admin integration approach before
  release; never add a duplicate DM viewer.

### Pending release gates
- The SQL draft is **not deployed**. Verify and test it in an isolated
  database before any production migration.
- Decide data retention and deletion semantics for evidence IDs; no message
  content/media is snapshotted by the draft, so physically deleted DMs may
  no longer be readable from the existing admin viewer.
- Connect ONE validated browser flow to the actual chat and panel only after
  backend tests, and ensure the report action works after the one-time popup
  has already been dismissed.
- Test with real authenticated users and admin/non-admin accounts, including
  cleared conversations, invalid evidence, PIN expiry, status changes and
  all ten locales.

## PIN cache hardening + ten-language active preview (2026-10-25)

- The active opt-in admin preview uses beta/admin-report-panel-bridge.js and beta/admin-report-queue.js, not the separate unused prototype stay-safe-admin-reports-bridge.js.
- Direct admin re-renders no longer replay cached conversation report metadata before a fresh PIN-protected server RPC check. The BETA cards are hidden until authorization succeeds.
- Server authorization errors, PIN expiry, invalid responses or an exception in the existing legacy admin loader purge BETA metadata and restore the existing PIN verification action.
- Report queue normalization now rejects invalid status values, timestamps, duplicate report IDs and responses above 100 rows; invalid backend metadata is no longer shown as a partial result.
- The real workers.dev admin preview supports en, es, pt-BR, fr, pl, de, cs, no, sv, it, including six reasons, statuses, actions and PIN text.
- Regression suites cover PIN renewal, invalid/duplicate data and all ten active locales. Seven selected BETA test suites passed using an isolated JavaScript compatibility harness; this does not verify GitHub Actions or execute Postgres SQL.
- Existing individual-message reports and the current full-DM moderator viewer are unchanged. No new report viewer was created.
- The SQL is REVIEW ONLY. It has not been executed against live Supabase; no production Cloudflare deployment was performed.

### Release requirements still open

1. Execute and audit the SQL in an isolated non-production database, with real authenticated and unauthenticated actors, cleared chats, deleted messages, PIN expiry and duplicate evidence.
2. Review incident data retention/deletion and privacy disclosures before storing reports.
3. Consolidate on one chat integration and one admin integration, rather than loading competing prototypes.
4. Add an always-available report action to live chat, independent of the one-time warning, only after backend readiness.
5. Verify the existing PIN, moderation reason and access audit protections still work in the real admin panel.

## Evidence picker regression + isolated PostgreSQL test gate (2026-10-25)

- The BETA evidence picker now presents the last 100 validated loaded messages (in the existing oldest-first display order), so recent abusive messages are not omitted by first-100 clipping.
- Case-insensitive evidence IDs are deduplicated before rendering; selecting a 21st message is rejected. The Swedish and Italian dictionaries were each reduced to one entry, retaining the correct submission labels.
- `beta/test-evidence-picker-dom.cjs` executes the actual selector using a DOM fixture, checking 100 recent items, 20 selected messages, UUID-case duplicates, dialog dismissal and Swedish/Italian action labels.
- Other targeted simulated suites verified account/session switching and the authenticated browser report flow. These are not proof that the server RPC is deployed.
- `beta/sql-test-fixtures.sql` and `beta/sql-test-report-pipeline.sql` are designed for an isolated disposable PostgreSQL 17 instance. The live Supabase project has no development database branch and has NOT received the new schema.
- IMPORTANT: `.github/workflows/xoxo-safety-postgres-isolated.yml` is currently manual-only (`workflow_dispatch`) and exists only on this feature branch, not `main`. GitHub normally requires the workflow file on the default branch for manual dispatch. Therefore these PostgreSQL tests are PREPARED BUT NOT EXECUTED, and the manual link should not be presented as immediately runnable.
- An attempt to enable narrowly scoped push-based execution via the GitHub connector was blocked; no workflow change or branch merge was made. Do not raise the SQL gate to passing without an observed PostgreSQL job result.
- GitHub Actions standard Ubuntu runners are free in public repositories, but no paid runner, Supabase branch, or production deployment has been used.

### Safe next gate

Run the isolated SQL job through an approved CI trigger (or on a separate local PostgreSQL 17 environment), inspect the first true SQL errors if any, and only then plan backend RLS/permission tests against a disposable Supabase environment. Preserve the existing PIN-protected conversation viewer, audit log and individual DM report cards.
