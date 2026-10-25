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
- [ ] Deploy and audit the four BETA RPC functions after explicit approval. Verify no broader table grants or admin access.
- [ ] Test signed-in reporter, unrelated account, malformed evidence, repeated idempotency key, and rate limit in real Supabase.
- [x] Browser smoke-test the standalone warning → report form → evidence picker using WebKit at 320×568 and 390×844 mobile viewports and Chromium at 1280×800; verify 20-message cap, modal geometry, keyboard focus, translations and one-time warning. Green in GitHub Actions 40172896880.
- [ ] Complete device testing on a physical iPhone/Safari and the integrated authenticated XOXO Avenue BETA chat; standalone WebKit emulation does not replace this.
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

### Moderation read audit and responsive UI smoke results (2026-10-25)

- The draft PIN-gated `xoxo_admin_list_conversation_reports_beta` function now writes a **single queue-view audit event** to the EXISTING `public.xoxo_message_access_log` on each successful list read, including the mandatory 10–300-character reason and number of reports returned. It uses an admin/admin UUID pair with an explicit queue-event action (NOT a fabricated DM access), while individual DM reads still log their actual participant pairs.
- The existing report-status update audit remains unchanged. Rejected queue reads and status changes must not create successful access events. SQL and real signed HTTP/PostgREST tests verify these invariants without granting ordinary users access to the sensitive audit table.
- Fixed the narrow-screen `box-sizing`, maximum viewport height and safe-area padding on `stay-safe-sweetheart.js`, `stay-safe-report-form.js` and `stay-safe-evidence-picker.js`. Report and evidence buttons use touch-friendly minimum heights and adapt to long translations. The evidence picker now traps Tab/Shift+Tab inside its modal. Duplicate Swedish and Italian strings were removed from the report form.
- **Real visual browser engines**: [GitHub Actions 40172896880](https://github.com/FriendHub1/FriendHub/actions/runs/40172896880) passed **all three jobs** (Node 22, PostgreSQL 17/PostgREST and the new browser job). Browser job launched **WebKit** in 320×568 Spanish and 390×844 Italian mobile emulations and **Chromium** in 1280×800 desktop English. It exercised one-time reminder, form, six report reasons, 20 selected evidence cap, keyboard focus trapping and modal overflow.
- It uploaded **synthetic screenshot artifacts** with seven-day expiration: [review UI captures](https://github.com/FriendHub1/FriendHub/actions/runs/40172896880/artifacts/12590911282). These screenshots are generated from artificial messages only and do not depict real users or content.
- **Not yet tested:** physical iPhone Safari, production app integration with live Supabase Auth, or privacy/retention decisions. Draft PR #12 remains unmerged. The browser preview cannot submit live reports and the production site has not been changed.

### Actual screenshot review and full-access audit (2026-10-25)

- **Visually inspected actual WebKit 320×568 screenshot files** downloaded from the GitHub Actions artifact. The previous screenshot opened the one-time warning near its bottom because the ACK button received automatic focus. The fixed warning now focuses the accessible dialog itself without auto-scrolling; GitHub browser tests assert that the warning's heading is immediately visible and the modal begins at `scrollTop=0`.
- The evidence picker previously rendered up to 1,000 text characters in every card, making abuse selection difficult on narrow screens. It now shows a compact **240-character preview** and a separately expandable full message. The expand/collapse labels cover all 10 supported languages, and WebKit + Chromium tests verify that full text can be opened before submitting selected message IDs.
- The report form now has explicit border-box sizing; all three dialogs support narrow safe-area viewports. Both report and evidence actions remain keyboard/touch accessible. The browser test also confirmed 20 selected evidence and denial of item 21.
- Successful PIN/reason-authorized report-queue reads now write a single clearly named audit event to the existing moderation access table, including a count and the reason. PostgreSQL and signed-JWT HTTP tests verify the event, while ordinary roles retain **no direct SELECT privilege** on the sensitive audit table.
- [Green GitHub Actions run 40172896880](https://github.com/FriendHub1/FriendHub/actions/runs/40172896880): all 3 jobs passed, including WebKit (two phone-sized layouts), desktop Chromium, Node tests, and PostgreSQL/PostgREST HTTP security and concurrency tests.
- Nine synthetic screenshots are available for 7 days via [GitHub artifact](https://github.com/FriendHub1/FriendHub/actions/runs/40172896880/artifacts/12590304440); they include no real private messages or real users.
- **Still open:** test real iPhone Safari hardware with the integrated live-auth BETA chat, real Supabase Auth sessions in a separate environment, and owner approval for evidence retention and the proposed report rate-limit. The PR remains a draft and no production database schema/Worker has been modified.

### Pending-report queue starvation protection (2026-10-25)

- Previous draft admin RPC returned the 100 **most recently created** cases; after a large influx of closed reports, an older `pending` safety report could disappear from the first 100 visible cards. This had an impact on actual moderation triage, even though the database still retained the report.
- `xoxo_admin_list_conversation_reports_beta` now orders **pending reports first**, newest within each status tier, **before** applying the 100-card limit. The JSON array preserves that same ordering. `beta/admin-report-queue.js` now also sorts its normalized cards pending-first instead of undoing the server priority.
- `beta/sql-test-admin-queue-priority.sql` inserts 120 newer synthetic resolved cases and three **95-day-old pending cases**. It verifies that all three pending cases remain visible in a 100-card result, all pending precede closed reports, response metadata omits message bodies, and the existing audit log records one 100-result queue read.
- `beta/test-safety-postgrest-queue-priority.py` repeats these assertions using the **real loopback PostgREST HTTP API and a signed synthetic admin JWT**, and verifies one additional read-audit event.
- The Node report queue regression exercises an older pending case versus newer reviewed and resolved cards. SQL source-contract checks prevent accidental removal of pending-first priority before the limit.
- [GitHub Actions run 40201828217](https://github.com/FriendHub1/FriendHub/actions/runs/40201828217) passed all three jobs: Node.js 22, PostgreSQL 17 with signed PostgREST HTTP, and WebKit/Chromium browser tests. No live data was accessed or changed.
- **Historical limitation (now resolved by the following cursor-paging section):** This checkpoint had a 100-report first-page limit; the paginated BETA can now request additional pages. The separate evidence retention/erasure policy is still unapproved.
- The source remains on the unmerged safety BETA branch and PR #12. No production SQL installation, Worker deployment or real Supabase Auth testing was performed.

### Full PIN-protected admin pagination — verified (2026-10-25)

- Added **fourth** BETA RPC `public.xoxo_admin_page_conversation_reports_beta(p_reason,p_after_pending,p_after_created_at,p_after_id,p_limit)` with a maximum of 50 reports per continuation request. The initial 100-result RPC remains backward compatible.
- The continuation key is the entire `(status='pending', created_at, report_uuid)` tuple, not just a timestamp or offset; pending cases are first, and timestamps shared across multiple reports do not cause duplicates or omissions.
- Every continuation request independently verifies a valid Supabase server-side Auth session, admin status, active/unlocked PIN, and 10–300-character moderation reason, and records its own **read audit event** in the existing moderation access table. It neither grants browser SELECT on private tables nor returns message text/attachments.
- Added **«Cargar más denuncias» / Load more reports** directly beneath conversation-report cards in the EXISTING admin panel, translated in all 10 locales. The additional page is fetched only on click. Existing individual-message cards and the PIN-gated conversation viewer are unchanged.
- The client hides existing BETA report cards during server reauthorization and purges them/requests the PIN again if loading another page fails. It de-duplicates IDs and removes the Load more button after the final page.
- [**GitHub Actions run 40203260705**](https://github.com/FriendHub1/FriendHub/actions/runs/40203260705) passed all three CI jobs (**Node.js 22, disposable PostgreSQL 17 with signed loopback PostgREST, and WebKit/Chromium visual tests**). PostgreSQL inserted 132 extra open cases and tested **277 cases total** with identical timestamps; the signed HTTP test traversed all **277 unique report IDs in five pages**, preserving pending-first order, correct response caps and one read-audit record per page.
- Node tests verify 50-report cursor page validation, malformed/unauthorized responses, 10-language button labels and the real existing admin bridge's loading/expiry behavior, including mock 100→150→175 progression.
- Remaining prerequisites are **real non-production Supabase Auth sessions**, owner-approved evidence-retention/deletion rules and final daily report limit, physical iPhone/integrated chat verification, and explicit permission before any production migration or rollout. This is still a **draft**, not a deployed feature. Full-history retrieval is now implemented through a manual Load more process, not automatic unbounded loading.

### Admin authentication lifecycle and late-response privacy — verified (2026-10-25)

- When the BETA moderation bridge receives **Supabase Auth SIGNED_OUT / SIGNED_IN or an account-identity change**, it invalidates its PIN-derived local unlock state, deletes sensitive BETA report cards and increments an async-response generation counter. Server access control was already required; this adds client-side privacy protection on top.
- The bridge also uses a **native MutationObserver** to erase private cards when the existing Moderation section loses its active class; navigating away fires **pagehide** and also clears the data. Returning to Moderation requires the PIN and reason flow again. Original legacy report cards are left untouched.
- A report queue or Load more RPC started under a previous session **cannot display its old results** after logout, even when that response arrives later.
- A **status-update RPC** started before logout cannot trigger the legacy admin-loader after the account/session changed, even if the server later reports success. Buttons retained in a detached old report card are inert after PIN authorization is invalidated.
- The new tests are **`beta/test-admin-auth-lifecycle.cjs`**, extended `beta/test-admin-report-pagination-panel.cjs`, and **`beta/browser-safety-admin-auth.cjs`**. The browser regression uses native WebKit and Chromium with synthetic accounts, a simulated Supabase Auth callback and delayed RPCs.
- [**GitHub Actions 40204647016**](https://github.com/FriendHub1/FriendHub/actions/runs/40204647016) passed all 3 jobs: Node.js 22, PostgreSQL 17 + local signed PostgREST, and browser emulation. The browser job explicitly logged both `PASS: webkit native auth events, tab exits, in-flight queue/status callbacks and pagehide purge sensitive admin rows` and the corresponding `chromium` pass.
- These are **browser and fake-session lifecycle tests**, not physical iPhone tests or proof of real Supabase-issued login integration. They do not authorize live SQL or deployment. Draft PR #12 remains unmerged; owner approval of retention/erasure and final limit is still required.

### PIN dialog auth-epoch hardening (2026-10-25)

- Added an **authorization-generation and account-ID guard** to the EXISTING moderation PIN dialog callback. A PIN dialog started by account A that completes after logout, a new SIGNED_IN event, or an account change **cannot set the new session's local report-unlocked state or trigger its report fetch**.
- An obsolete PIN-error callback also **cannot invalidate or erase a newly authenticated administrator's reports**. This prevents cross-login asynchronous callback interference without changing the existing six-digit server PIN or audit.
- Fixed the continuation-load bookkeeping: when a late `Load more` response belongs to an invalidated auth generation, it is discarded **before** touching the newer generation's loading lock.
- Added explicit adversarial regressions in `beta/test-admin-auth-lifecycle.cjs` for both stale PIN success and stale PIN failure. Added real WebKit/Chromium browser coverage in `beta/browser-safety-admin-auth.cjs` for PIN dialog completion after SIGNED_OUT.
- All three jobs—Node.js 22, disposable PostgreSQL 17/PostgREST and WebKit/Chromium—passed in [GitHub Actions 40205626563](https://github.com/FriendHub1/FriendHub/actions/runs/40205626563), including the PIN-dialog race regressions.
- No live SQL, production users, Cloudflare Workers or actual Supabase Auth sessions were changed or used. The non-production Auth, retention, report-limit and physical-device approvals remain open.

### Idempotent report tampering and anonymous Auth checks (2026-10-25)

- **Previously accepted report IDs and metadata must be immutable.** Signed local PostgREST HTTP tests now try reusing the exact same idempotency key with changed details, reason, reported participant or evidence IDs. These attempts must be denied, leaving exactly the original report and its saved evidence IDs.
- The baseline disposable PostgreSQL test had already physically deleted a reported DM. The additional `beta/sql-test-evidence-after-delete.sql` verifies that the accepted report and evidence *metadata* persist and a byte-identical idempotent retry recovers the original receipt after deletion; altered fields remain rejected. It explicitly asserts no new message-text/content snapshot columns were silently introduced. This **does not establish the final retention policy**, which remains an owner decision.
- The draft `xoxo_safety_private.active_session_for()` now rejects a JWT with `is_anonymous: true` before allowing any of the four report/admin RPCs. This matters because **Supabase anonymous sign-ins use the same `authenticated` database role** as permanent members. The guard is based on Supabase's documented claim, not user-editable metadata.
- Locally signed PostgREST tests separately confirm anonymous signed-in users cannot submit reports or use the admin PIN-gated queue, while valid permanent accounts continue to work.
- [GitHub Actions 40206965703](https://github.com/FriendHub1/FriendHub/actions/runs/40206965703) passed all three jobs for the deleted-message/immutable-receipt integrity tests. [Run 40207107332](https://github.com/FriendHub1/FriendHub/actions/runs/40207107332) verifies the additional anonymous-sign-in guard; check all job conclusions before claiming the complete run passed.
- All testing uses synthetic users, signed CI-only JWTs and disposable PostgreSQL/PostgREST. No production Supabase data or Cloudflare worker was changed. The non-production Auth environment, deletion/retention policy and physical iPhone review remain release blockers.

### Signed-in account changes during report submission — verified (2026-10-25)

- `beta/stay-safe-browser-report-adapter.js` now verifies the **current non-anonymous signed-in account** three times: before looking up selected DM IDs, immediately before the report RPC after that asynchronous lookup, and before displaying a successful receipt after the RPC. A change of account suppresses the old account's report receipt and prevents the pre-RPC submission when the identity changes during the evidence fetch. Server-side authorization remains mandatory and authoritative.
- `beta/stay-safe-browser-flow.js` now prevents obsolete chat flows from opening new forms, safety notices or evidence pickers after a conversation/account change. A late successful report RPC does **not** display a receipt or alert in the new conversation. The original idempotency key is retained until its session context ends or an appropriate retry occurs.
- `beta/test-browser-report-flow.cjs` simulates a user swapping accounts during a suspended evidence query, a report request that completes after logout, an async message listing finishing after chat navigation, and rejection of temporary anonymous Supabase sign-ins.
- **[GitHub Actions 40207700106](https://github.com/FriendHub1/FriendHub/actions/runs/40207700106)**: all three suites passed — Node.js 22, PostgreSQL 17/local PostgREST, and WebKit/Chromium browsers. No production SQL, account, messages, or Worker deployment changed.
- Remaining release prerequisites are actual non-production Supabase Auth-issued sessions, owner-approved deletion/retention policy and daily reporting limit, physical iPhone/integrated BETA acceptance, and explicit production rollout authorization.

### Prevent duplicate taps during asynchronous evidence reload (2026-10-25)

- Fixed an actual browser concurrency window: the `sending` guard previously activated **after awaiting** the current chat's message re-read. Two rapid taps on Send could therefore start overlapping evidence reads and potentially duplicate status messages/RPCs.
- `beta/stay-safe-browser-flow.js` now acquires the guard **before** awaiting `getMessages()` and releases it with a `finally` block on every success, validation failure, network exception, or change of conversation.
- Added regressions in `beta/test-browser-report-flow.cjs`: two immediate submit callbacks during a delayed evidence query must make **one** query, **one** report submission, and **one** status notification; a failed evidence reload must release the guard so a later valid retry works.
- **[GitHub Actions 40208148813](https://github.com/FriendHub1/FriendHub/actions/runs/40208148813)** passed all three jobs: Node.js 22, disposable PostgreSQL 17 with signed local PostgREST, and WebKit/Chromium browsers.
- The existing server-side idempotency key remains an independent defense. No production Supabase SQL or Worker was changed; report writing remains disabled in the BETA preview.

### Single evidence picker during async message loading (2026-10-25)

- Fixed a race between a closed reporting form and the asynchronous `getMessages()` call: repeated form callbacks could previously start **multiple** evidence requests and competing pickers before the existing report-submission lock activated.
- `beta/stay-safe-browser-flow.js` now uses a separate `loadingEvidence` guard, acquired **before** awaiting the initial messages and released in `finally`. It blocks reopening another report form during that load without interfering with the independent `sending` submission lock.
- Regression tests invoke the form callback twice while a promise is suspended. They verify **one** message fetch, **one** evidence picker, no premature report RPC, and no duplicate alerts. They also verify failed evidence loads unlock correctly so the reporter can retry.
- [GitHub Actions 40208534428](https://github.com/FriendHub1/FriendHub/actions/runs/40208534428): **all three jobs passed** — Node.js 22, disposable PostgreSQL 17/PostgREST, and WebKit/Chromium browser checks.
- Live report writes remain disabled; no production deployment, migration, or merge was performed.

### Recent-message ordering independent of chat API array direction (2026-10-25)

- Fixed a real evidence-selection edge case: the picker previously took the **last 100 rows** from whatever message order the chat client returned. When a provider returned messages **newest first**, this could omit the newest potential abuse evidence and show older messages instead.
- The BETA preview bridge and report flow now forward the **already-loaded DM's `created_at`** to the evidence picker. When all supplied messages have valid timestamps, the picker sorts them chronologically before displaying the latest 100. It does not fetch additional messages or forward text to the report RPC; only explicitly selected message IDs are submitted.
- With incomplete or invalid timestamps, the picker deliberately retains existing input-order behavior, rather than guessing unknown chronology. Server-side authorization and deleted-message filtering are still authoritative.
- Added Node DOM tests for **120 chronological, reversed and shuffled messages**, case-insensitive duplicate IDs, max 20 selections and missing-date backwards compatibility. Added a browser-flow test for timestamp forwarding and a preview-bridge test that confirms the original signed-in chat dates survive the adapter.
- Real WebKit at 320×568/390×844 and Chromium desktop each now exercise a **120-message newest-first synthetic chat**, require exactly IDs 21–120 to be presented in the 100-choice picker, and confirm message 120 remains selectable.
- [GitHub Actions run 40209397348](https://github.com/FriendHub1/FriendHub/actions/runs/40209397348) passed all three jobs (Node.js 22, disposable PostgreSQL 17/PostgREST, WebKit/Chromium).
- This is BETA only. Production DM order, real user content, Supabase schema, moderator PIN and Cloudflare Worker were not modified.

### Reject detached report forms/pickers within the same conversation (2026-10-25)

- Fixed an additional stale-callback scenario that **chat/account identity checks alone did not cover**. While still in the same DM, a user could open a newer report form while an older evidence picker or detached form retained a callback with its former reason and message selection.
- `beta/stay-safe-browser-flow.js` now assigns each report-form opening a monotonically increasing **form epoch**. An obsolete form cannot load evidence, and an obsolete picker cannot submit it after a newer attempt opens in the same conversation. This is independent of the existing current-account, active-chat and in-flight submit locks.
- `beta/test-browser-report-flow.cjs` verifies the old form/picker are inert with no RPC or status alert while the new form/picker remains functional and can submit exactly once.
- [**GitHub Actions run 40210683738**](https://github.com/FriendHub1/FriendHub/actions/runs/40210683738) passed **all three** jobs: Node.js 22, disposable PostgreSQL 17/PostgREST, and WebKit/Chromium browser checks.
- The BETA reporting write flag remains off. No production SQL, Cloudflare Worker or existing live moderator viewer changed.

### Cancelled report dialogs cannot submit stale evidence (2026-10-25)

- Both standalone BETA dialogs (`stay-safe-report-form.js` and `stay-safe-evidence-picker.js`) now close **idempotently**, with a per-dialog `closed` guard set before DOM removal. Queued/detached submit callbacks after **Cancel, Escape or successful submission** cannot invoke their reporting callback again.
- The evidence picker also ignores checkbox change notifications from a closed dialog, and reopening a fresh picker remains functional.
- DOM regression checks in `beta/test-evidence-picker-dom.cjs` exercise Cancel followed by a stale submit and a valid double-click that must invoke the callback exactly once.
- Native browser tests in `beta/test-safety-browser-visual.cjs` exercise the report form and picker in **WebKit (320/390px) and desktop Chromium**: cancelled old handlers do nothing, double submission invokes once, and no sensitive modal remains mounted.
- [**GitHub Actions run 40211235284**](https://github.com/FriendHub1/FriendHub/actions/runs/40211235284) passed **all three** jobs: Node.js, disposable PostgreSQL 17/local PostgREST, and WebKit/Chromium.
- No live Supabase schema, production Worker, admin panel, user conversations, or report-write flags were changed. The original non-production Auth, retention/erasure approval and physical-iPhone release gates remain in place.

### Remove private evidence dialogs when leaving a DM (2026-10-25)

- Fixed a privacy leak in the BETA preview: previous account/chat checks blocked old report **submissions**, but a report form or evidence picker could still **remain visible with old private DM text** after switching conversations or closing the chat.
- Added owner-scoped `dismiss(owner)` in the standalone report form and evidence picker. Each browser flow receives a unique owner object and exposes idempotent `dispose()`. Disposal closes **only that flow's** dialogs, invalidates previous form attempts and discards its client-side retry key; it cannot remove an unrelated newer chat's form.
- The preview bridge calls disposal on a changed peer, account, locale, Supabase client, unavailable/hidden DM, or pagehide. Native `MutationObserver` now watches DM message changes, chat visibility and **nested header edits** that can occur when changing peers.
- Supabase `SIGNED_OUT` / `USER_DELETED` marks the preview as signed-out so late chat DOM redraws **cannot reconstruct a former user's report UI**. `SIGNED_IN` restores it only when the logged-in identity matches the current account shown by the SPA.
- Added `beta/browser-safety-chat-navigation.cjs`: real **WebKit and Chromium** exercise peer/header changes, disappearing private evidence, hiding a chat, auth logout, stale post-logout re-renders, new sign-in with an old account still in the DOM, and normal recovery once the new account is installed.
- Added ownership/disposal tests to the browser-flow and preview-bridge Node suites, plus mobile WebKit/Chromium tests for preventing old disposal from closing a new chat's dialogs.
- [**GitHub Actions run 40212566379**](https://github.com/FriendHub1/FriendHub/actions/runs/40212566379) passed **all three jobs:** Node.js 22, disposable PostgreSQL 17/PostgREST, and WebKit/Chromium. All data are synthetic.
- The BETA report RPC write flag stays off; no production changes were made. Physical iPhone integrated acceptance, real non-production Supabase Auth tokens, privacy retention policy and deployment permission remain open.

### Same-chat report reopens now dismiss earlier private evidence UI (2026-10-25)

- Fixed a visual privacy/UX issue: opening a **second report in the same DM** already invalidated callbacks from the old form/picker, but the old picker could remain *visibly open with private text behind the new form*. This is different from switching peers and needed a separate safeguard.
- `beta/stay-safe-browser-flow.js` now increments the form-attempt epoch and **dismisses its own currently displayed form and evidence picker** before opening the replacement form. Ownership scoped to the current flow ensures another conversation's modal cannot be closed accidentally.
- `beta/test-browser-report-flow.cjs` verifies the old picker is actually dismissed, not merely made inert; the replacement form still works and submits once.
- `beta/test-safety-browser-visual.cjs` verifies in real WebKit (320px and 390px mobile simulation) and Chromium (desktop) that two consecutive report openings leave **one form**, reopening from the evidence stage removes the old private picker, and disposing the flow leaves zero overlays.
- **[GitHub Actions 40213041646](https://github.com/FriendHub1/FriendHub/actions/runs/40213041646) passed all 3 jobs** (Node.js 22, disposable PostgreSQL 17 + local PostgREST, WebKit/Chromium). Test data remained synthetic.
- No production deployment, Supabase migration, live report writes or PR merge. Owner decisions on evidence retention, reporting limit, real Supabase Auth testing and physical iPhone review remain release prerequisites.

### Fail-closed on Supabase Auth initial session and refresh (2026-10-25)

- Fixed a **privacy exposure before Auth initialization** in `beta/stay-safe-chat-preview-bridge.js`: the BETA report button/form could previously be enabled from stale SPA `currentUser`/DM cache **before** Supabase's initial stored session was verified. The bridge now starts **locked** until an `INITIAL_SESSION` or a valid `SIGNED_IN` event with a matching non-anonymous user ID arrives.
- A null initial session, a null `TOKEN_REFRESHED` result, an anonymous user, or a session ID belonging to a different displayed account now **fail closed**. `SIGNED_OUT`/user deletion still invalidate and dispose previous forms immediately. Valid `SIGNED_IN` or `TOKEN_REFRESHED` events restore preview controls after the SPA displays the matching identity.
- The Auth handler uses the synchronous event/session data and **never calls async Supabase APIs within `onAuthStateChange`**. It does not activate writing; `REPORT_RPC_WRITES_ENABLED=false` remains hardcoded.
- Updated the canonical-preview, account-switch and alternate-preview Node suites with realistic `INITIAL_SESSION` and token-change simulations. Added native WebKit/Chromium scenarios verifying invisible initial button, null/anonymous/expired sessions, successful valid session recovery, and identity-bound account changes.
- **[GitHub Actions 40213979182](https://github.com/FriendHub1/FriendHub/actions/runs/40213979182) passed all three jobs**: Node.js 22, disposable PostgreSQL 17 + local signed PostgREST, and WebKit/Chromium browser checks. Test accounts/messages are synthetic.
- **Release gate remains** real non-production Supabase Auth-issued sessions, privacy retention approval, a physical iPhone integrated login flow, and separate authorization before any production deployment. The BETA preview's initial Auth event is a simulated test; not evidence of a real user login integration.

### Isolated real Auth-issuer experiment — not yet release-cleared (2026-10-25)

- Added a *standalone experimental*, synthetic-only `beta/test-safety-gotrue-auth-http.py` harness to accept genuine self-hosted Supabase GoTrue-issued session tokens and exercise the draft report RPC, message RLS, replay receipt and revoked-session denial through a loopback PostgREST server. Its two databases would be disposable; it never connects to live project Supabase.
- A pinned `supabase/gotrue:v2.197.0` container starts, but **standalone GoTrue database migration/configuration is not reliably compatible with the raw PostgreSQL-17 fixture**. The first runs failed on absent `identities`/migration namespace, and the explicitly migrated setup later failed around OAuth migration/index creation. **These failures do not demonstrate successful genuine Supabase Auth session integration.**
- To keep the required CI reliable, the experimental GoTrue step was **removed from the mandatory GitHub Actions workflow**; the harness is retained for a separate, explicitly isolated follow-up after a compatible Auth database bootstrap is proven. Do not count this release gate as complete or claim real Supabase-issued JWTs were validated.
- Existing mandatory Node.js, signed-local-JWT PostgREST/PostgreSQL, and WebKit/Chromium checks remain in the workflow. This experiment did not apply any SQL to production, reveal credentials, or enable real report writes.

### Prevent concurrent edits of reported messages during atomic evidence capture (2026-10-25)

- Closed a PostgreSQL concurrency gap in the draft report-submission RPC: the previous `SELECT ... FOR KEY SHARE` blocked deletion of selected messages but **did not lock non-key updates** such as changing message content, recipient or `created_at`. This could let the evidence metadata disagree with the message that the reporter actually selected.
- The private BETA RPC now selects its 1–20 validated DM rows **`FOR SHARE`**, which holds a stronger lock until the report and evidence metadata finish their atomic transaction. There is **no broad table lock** and no change to live messages or their permissions.
- The SQL contract regression now explicitly requires the stronger lock and rejects a return to the weaker statement. The new `beta/test-safety-evidence-row-lock.py` test uses **two real concurrent PostgreSQL connections in a disposable CI database**; a second connection's attempts to modify a protected DM's content, recipient and timestamp all fail with lock timeouts. After the lock is released, the message's attributes remain unchanged and the synthetic fixture is deleted.
- The real concurrency test printed `PASS: real concurrent PostgreSQL FOR SHARE protects reported DM content, recipient and created_at against non-key updates` in [GitHub Actions 40215275615](https://github.com/FriendHub1/FriendHub/actions/runs/40215275615). JavaScript and native WebKit/Chromium test jobs also passed. **That run's overall PostgreSQL job subsequently failed in the separate experimental GoTrue Auth startup**, not in the message-lock test; do not call that run completely green.
- The GoTrue isolated Auth harness remains a separate release-validation item; the usual signed synthetic PostgREST JWT tests and SQL security tests passed. This change did not use real Supabase credentials, alter production Auth or install the BETA SQL on the live project.
- **Final verification:** [GitHub Actions 40215615927](https://github.com/FriendHub1/FriendHub/actions/runs/40215615927) passed **all three jobs** (Node.js, PostgreSQL 17/local PostgREST and WebKit/Chromium) with the stronger evidence-row locking. The experimental standalone GoTrue startup step was separated from the green SQL/browser regression workflow; real Auth integration is still an explicit release gate.
