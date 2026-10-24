# XOXO Reveal BETA — security readiness review (2026-10-19)

**Status: NOT READY for a real-photo test against production.** This review only inspects beta-branch drafts. No deployment, database migration, live DM write, Storage upload or real photo test was performed.

## Verified from beta source
- Upload HTTP handler validates origin/metadata and bounds request body, but has no production dependency wiring, no persistent quota integration, and no transaction-safe DB/Storage link.
- Quota guard verifies sender and supports injected atomic reserve/refund, but is **not connected** to HTTP; retry/idempotency and uncertain commit outcomes remain unresolved.
- Cleanup review and audit modules generate read-only reports. Moderation holds are injected; they are **not queried from authoritative live tables**. No deletion worker or scheduled job exists.
- Audit SQL is **REVIEW ONLY**, not applied. Append-only trigger blocks DELETE, including a future 90-day retention purge; a separately reviewed retention mechanism is required.
- The existing real-photo test gate explicitly states that no live test has occurred, Storage Range/Safari behavior are unverified, and timers currently begin at server START rather than first displayed frame.

## Required before first isolated real-photo test
1. Provision a genuinely isolated Supabase test project, with separate credentials, bucket and consenting test accounts; a Git branch alone is not database isolation.
2. Reconcile and review all schema drafts together (Reveal, prepare/start, quota, audit). Do not apply the superseded claim-open migration.
3. Implement and security-review a complete upload Edge Function with authenticated sender, exact DM acceptance/block checks, media validation, private path creation, quota enforcement, rollback/reconciliation and no credential leakage.
4. Fix and verify Range proxy behavior against private Storage; test bounded 206 responses, authorization, concurrent requests and Safari.
5. Resolve duration semantics: requested viewing seconds must begin when the image/video becomes visible/playing, while the server still enforces an upper bound against abuse.
6. Confirm one-time/session concurrency, expiration, revocation, report/hold checks and cleanup lease semantics.
7. Measure bandwidth and billing in the isolated environment with one synthetic WebP before any production rollout.

## Decisions that remain open
- Whether 5/10/15/20 seconds means guaranteed visible playback or a server-enforced maximum window (slow networks matter).
- Retention of reported media and audit rows, including lawful purge procedures.
- Quota retry/idempotency strategy and acceptable operational costs.

## Safety rule
Do not merge, deploy, apply SQL, run destructive cleanup, or use real user photos without explicit separate authorization. Mock tests passing means the draft logic passed mock tests, **not** that the full service is production-safe.
