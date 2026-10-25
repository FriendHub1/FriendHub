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
7. The warning, form, evidence picker, active admin report preview and submission feedback support **all 10 languages**: `en`, `es`, `pt-BR`, `fr`, `pl`, `de`, `cs`, `no` (website `nb` alias), `sv`, `it`. They are covered by CI.

## Tests in BETA

GitHub Actions (`.github/workflows/xoxo-safety-beta-tests.yml`) runs all `beta/test-*.cjs` on **real Node.js 22**, checks JavaScript syntax, and creates **disposable PostgreSQL 17** to execute the proposed SQL, RLS/auth fixtures and report/admin RPC integration cases. The workflow was triggered by [Draft PR #12](https://github.com/FriendHub1/FriendHub/pull/12), which remains unmerged.

Tests include:
- `test-admin-report-queue.cjs`: legacy+BETA queue shape and status mapping.
- `test-admin-report-panel-bridge.cjs`: PIN before BETA queue reads; legacy cards and existing viewer retained.
- `test-stay-safe-chat-preview-bridge.cjs`: read-only preview, visible evidence scoped to selected peers, no writes or duplicate UI; actual submission guard cases run in `test-browser-report-flow.cjs`.
- `test-stay-safe-i18n.cjs`: known localized warning, six report reasons, evidence selection.
- `test-safety-rpc-compatibility.cjs`: consistent server RPC names, metadata fields, preview wiring.
- `test-conversation-report-sql-contract.cjs`: 32 static SQL safety rules plus regressions for invalid PostgreSQL expressions and DO block quoting.

**Verified green run:** [GitHub Actions 40171472217](https://github.com/FriendHub1/FriendHub/actions/runs/40171472217) — Node.js 22, isolated PostgreSQL 17, and a local PostgREST 12 HTTP API with signed test JWTs all passed, including session guards, privacy, concurrency and PIN checks. The PostgreSQL job executed 17 named groups of integration/security assertions on temporary fixtures: report inserts, evidence bounds, access controls, cleared messages, duplicate/rate-limit handling, PIN, audit and status. The SQL was compiled and executed on PostgreSQL **but has NOT been deployed to real Supabase or exercised with live authentication/session tokens**. The website and production Cloudflare deployment remain untouched.

## Release blockers

- [x] Execute SQL and RLS report/admin integration tests against isolated PostgreSQL 17 with GitHub Actions; run 40171472217 passed. This is NOT a live Supabase E2E test.
- [x] Exercise the actual PostgREST HTTP API using signed, synthetic JWTs: authenticated report submission, revoked tokens, anonymous denial, private RLS, admin PIN expiry/lockout, deleted chat visibility and audited status changes.
- [x] Verify 12 concurrent submissions respect 10-per-day limit, 8 identical retries create a single report, and retry after quota returns the original report ID.
- [x] Verify unauthorized users, expired PINs and locked PINs cannot change report status or create an administrative status audit entry.
- [ ] Audit SQL function privileges, behavior and RLS in an isolated non-production Supabase environment.
- [ ] Approve evidence retention (the draft stores selected IDs + participant/timestamps, not copies of message text/media); confirm treatment of physical deletion.
- [ ] Approve or modify the proposed rate limit of 10 reports per user per 24 hours.
- [ ] Deploy and audit the three RPC functions after explicit approval. Verify no broader table grants or admin access.
- [ ] Test signed-in reporter, unrelated account, malformed evidence, repeated idempotency key, and rate limit in real Supabase.
- [ ] Test BETA preview UX on desktop/iPhone and ensure each chat displays the warning once per account.
- [x] Confirm all 10 site languages, including Bokmål `nb` -> `no` mapping, and validate user-facing safety copy in CI.
- [ ] Verify moderation PIN expiry, unauthorized admin access, status changes and audit records end-to-end.
- [ ] Verify no regressions to legacy single-message reports or admin DM viewer.
- [ ] Request owner approval before any production rollout.

**Never report an untested server submission as a successful deployment.**

### Confirmed BETA security checkpoints

- The active SQL remains review-only and was never applied to the connected Supabase production project. The latest CI jobs use ephemeral PostgreSQL 17, not production tokens or messages.
- Concurrent report submission and idempotency were exercised with real parallel database connections using `beta/test-safety-postgres-concurrency.py` (passed in run 40169561842 and 40169745436).
- Unauthorized users, expired PINs and locked PINs were checked against a persisted report ID in real PostgreSQL; forbidden status changes left status and audit unchanged. The valid PIN + moderation reason path still completes successfully.
- Draft PR #12 remains unmerged; release still depends on non-production Supabase Auth/PostgREST integration, privacy/retention approval, the final 10/day limit decision and browser/iPhone UX checks.

### New protection verified in isolated PostgreSQL (2026-10-25)

- Submission, report queue and report status functions all require an active server-side Supabase Auth session: the signed `auth.jwt()` `session_id` must match an `auth.sessions` record owned by the same `auth.uid()`, with `not_after` either unset or in the future.
- This check is factored into `xoxo_safety_private.active_session_for(uuid)`, a helper in a non-exposed schema with direct EXECUTE privileges revoked from `anon` and `authenticated`.
- Disposable PostgreSQL 17 tests rejected missing, mismatched, time-expired and physically deleted sessions. An admin's existing PIN did not override a mismatched Auth session.
- CI checked that browser database roles cannot select `auth.sessions` or invoke the private session helper. The report submission, existing PIN controls, audit actions, 12-way rate-limit stress and 8-way idempotency all remained green.
- Removed duplicate `sv` and `it` object keys from the safety-warning COPY and ACTIONS dictionaries. A new Node regression prevents silent key overwrites; all ten locales still pass.

**Important:** SQL CI uses stubbed JWT claims and session rows, not live Supabase Auth. This is a proven PostgreSQL behavior test, **not** an Auth/PostgREST integration certification. Real-login testing remains a release blocker. This feature branch and PR #12 have not been merged or deployed; live Supabase has not been modified.

### Real HTTP/PostgREST interoperability verified (2026-10-25)

- [GitHub Actions 40171472217](https://github.com/FriendHub1/FriendHub/actions/runs/40171472217) passed Node 22 and PostgreSQL 17 jobs. The disposable database hosted **PostgREST 12.2.12 bound exclusively to 127.0.0.1** with a limited SQL authenticator role.
- `beta/test-safety-postgrest-http.py` signed synthetic HS256 JWTs with an explicitly test-only local key, then sent real HTTP `/rpc/xoxo_submit_conversation_report_beta` and PIN-protected admin RPC requests. This exercised authentication/role switching, database RLS, server-side session revocation, wrong identity and JWT signature, expired tokens, evidence limits, idempotency, and audit logs through the HTTP transport.
- Expanded test coverage confirms that **one person's chat clear hides their own messages but does not erase the other person's history**, and that a cleared message cannot be attached to a NEW report. Previously saved report metadata persists for moderation subject to the still-unapproved retention policy.
- The admin API refused list and status changes with expired PIN, locked PIN, or mismatched authenticated session. The report status remained unchanged after denied changes.
- `beta/test-safety-ci-http-isolation.cjs` prevents weakening the localhost-only HTTP/DB settings or accidentally adding production deployment commands to the CI workflow. It passed along with all other Node checks.
- The JWT signing key and database credentials are **fictional values hardcoded solely for temporary CI**. No project API key, service-role key, real email, user record or production message was accessed. Neither the production Workers service nor Supabase schema was modified.

**Critical scope:** PostgREST HTTP and PostgreSQL RPC interoperability are now demonstrated using *locally signed synthetic JWTs and stubbed Auth tables*, **not actual Supabase Auth-issued logins**. A separate real Supabase Auth/PostgREST environment, owner-approved retention/deletion policy, final rate-limit decision and device visual checks remain required before enabling or deploying this feature. PR #12 remains in DRAFT state with no merge.
