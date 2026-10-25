# Stay Safe, Sweetheart! — BETA implementation and release gate
Last reviewed: 2026-10-25

## Scope and architecture

- Production website: https://xoxoavenue.com
- Repo: FriendHub1/FriendHub
- Working branch: feature/xoxo-safety-reminder-beta
- Supabase project: cxosofpxfmjkrhfabrqc
- Existing moderator: @XOXOAdmin
- **The existing full-DM admin viewer is authoritative. Never build a duplicate viewer.**
- Keep existing six-digit moderation PIN, moderation reason entry and audit log.
- Do not replace legacy `direct_message_reports`, `get_xoxo_dm_reports` or `update_xoxo_dm_report_status`.

## Newly connected BETA pieces

1. `beta/stay-safe-conversation-reports-schema.sql` is review-only SQL for private report/evidence storage and three RPCs; **NOT deployed**.
2. `beta/admin-report-queue.js` now understands the actual SQL metadata (`reported_user_id`, `message_ids`) and uses the same RPC names.
3. `beta/admin-report-panel-bridge.js` shows a moderation-PIN unlock control before requesting BETA report metadata, then reuses `openXoxoDmConversation` for full chat review. Legacy report cards remain.
4. `beta/stay-safe-chat-preview-bridge.js` connects warning → reason form → 1–20 evidence selection → authenticated RLS preflight → proposed server RPC. If the server RPC is absent, a report is **NOT** marked submitted.
5. `worker.js` only adds chat preview scripts for the `xoxo_safety_chat_beta=1` query on `*.workers.dev`. The pre-existing admin preview `xoxo_safety_admin_beta=1` route is also restricted to `*.workers.dev`.
6. `index.html` is intentionally unchanged. The Worker injects BETA scripts into preview responses.
7. The warning, report form, evidence picker and the chat preview's submission feedback have translations in eight confirmed locales: `en`, `es`, `pt-BR`, `fr`, `pl`, `de`, `cs`, `no` (`nb` maps to Norwegian). The remaining two site locale identifiers still require confirmation; do not guess.

## Tests in BETA

GitHub Actions (`.github/workflows/xoxo-safety-beta-tests.yml`) runs every `beta/test-*.cjs` using Node 22, plus JavaScript syntax checks.

Tests include:
- `test-admin-report-queue.cjs`: legacy+BETA queue shape and status mapping.
- `test-admin-report-panel-bridge.cjs`: PIN before BETA queue reads; legacy cards and existing viewer retained.
- `test-stay-safe-chat-preview-bridge.cjs`: login, conversation membership, visible evidence, report submit, duplicate selections, changes of peer.
- `test-stay-safe-i18n.cjs`: known localized warning, six report reasons, evidence selection.
- `test-safety-rpc-compatibility.cjs`: consistent server RPC names, metadata fields, preview wiring.
- `test-conversation-report-sql-contract.cjs`: 25 static SQL safety rules.

These tests are simulated/static; **they do not prove live Postgres permissions, Cloudflare deployment or actual successful reports**.

## Release blockers

- [ ] Audit SQL function privileges, behavior and RLS in an isolated non-production Supabase environment.
- [ ] Approve evidence retention (the draft stores selected IDs + participant/timestamps, not copies of message text/media); confirm treatment of physical deletion.
- [ ] Approve or modify the proposed rate limit of 10 reports per user per 24 hours.
- [ ] Deploy and audit the three RPC functions after explicit approval. Verify no broader table grants or admin access.
- [ ] Test signed-in reporter, unrelated account, malformed evidence, repeated idempotency key, and rate limit in real Supabase.
- [ ] Test BETA preview UX on desktop/iPhone and ensure each chat displays the warning once per account.
- [ ] Confirm the two remaining site language codes and translate every user-facing message.
- [ ] Verify moderation PIN expiry, unauthorized admin access, status changes and audit records end-to-end.
- [ ] Verify no regressions to legacy single-message reports or admin DM viewer.
- [ ] Request owner approval before any production rollout.

**Never report an untested server submission as a successful deployment.**
