# XOXO Reveal BETA — isolated PostgreSQL integration gate

**Not executed. No production database, secrets or network access required.**

## Required isolated environment
A disposable PostgreSQL instance with a minimal Supabase-compatible `auth.users`, `auth.uid()`, `auth.role()`, `storage.buckets`, and `public.direct_messages` fixture. Never connect this gate to the existing Supabase project. The test runner must refuse a non-local database URL and must run inside a rolled-back transaction or disposable database.

## Apply only reviewed drafts in this dependency order
1. `20261019_xoxo_reveal_beta_REVIEW_ONLY.sql`
2. `20261019_xoxo_reveal_idempotency_REVIEW_ONLY.sql`
3. `20261019_xoxo_reveal_quota_isolated_v2_REVIEW_ONLY.sql` (**not** the older quota file)
4. `20261019_xoxo_reveal_reconciliation_links_REVIEW_ONLY.sql`
5. `20261019_xoxo_reveal_claim_upload_v2_REVIEW_ONLY.sql` (**not** claim v1)
6. `20261019_xoxo_reveal_finalize_upload_v1_REVIEW_ONLY.sql`

## Transactional scenarios
- Two concurrent claims with the same verified sender, request key and fingerprint: exactly one `claimed`, the other `wait`.
- Same request key with a different fingerprint: `reject` and no new upload.
- Claim owner token cannot be used by another attempt or sender.
- Finalize only when the matching Reveal and DM exist, including recipient equality.
- Repeated finalize with identical result returns `already_completed`; conflicting IDs are rejected.
- Failed or uncertain attempts cannot be automatically re-claimed.
- Quota limits: 120/hour, 600/day, 1200 MiB/hour; concurrent reservations cannot exceed limits.
- Refund cannot be called by `authenticated` role; only trusted server.
- Storage and DB mismatches remain in manual reconciliation, never blind retry.
- RLS and direct table grants prevent browser reads/writes of private Reveal records.
- Rollback on deliberate SQL exception leaves no partially committed database state.

## Known blockers BEFORE PostgreSQL execution
- Existing draft finalize RPC does not validate attempt_id, fingerprint or private-object association; this must be corrected.
- The existing claim RPC has no lease expiry recovery protocol; a pending claim cannot be safely stolen.
- Quota reservations are not atomically bound to the upload attempt.
- The links migration is not idempotent; repeated ADD CONSTRAINT statements fail.
- SQL migrations depend on Supabase schema fixtures and cannot be run against plain PostgreSQL unmodified.
- Storage writes and DB writes are not one transaction. Test reconciliation and rollback separately.
- Tests need disposable PostgreSQL runtime, verified roles, and an explicit go/no-go review.

**This gate is a specification, not a claim that integration tests have passed.**
