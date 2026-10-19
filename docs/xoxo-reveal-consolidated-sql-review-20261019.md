# XOXO Reveal BETA — consolidated SQL review (19 October 2026)

**Review only. No SQL executed. No production deployment.**

## Recommended isolated-test order
1. `20261019_xoxo_reveal_beta_REVIEW_ONLY.sql` — private bucket and Reveal table.
2. `20261019_xoxo_reveal_idempotency_REVIEW_ONLY.sql` — upload attempts.
3. `20261019_xoxo_reveal_quota_REVIEW_ONLY.sql` — reservations (CURRENT FILE HAS SYNTAX ERROR).
4. `20261019_xoxo_reveal_reconciliation_links_REVIEW_ONLY.sql` — attempt/object/quota links.
5. `20261019_xoxo_reveal_claim_upload_v2_REVIEW_ONLY.sql` — server-only claim.
6. `20261019_xoxo_reveal_finalize_upload_v1_REVIEW_ONLY.sql` — fenced completion.

Do not run this sequence as-is: it is a dependency map, not an executable migration plan.

## Confirmed problems
- The quota migration terminates the refund function body with `AS $` / `$;` rather than valid PostgreSQL dollar quoting. A corrected **separate draft** is required before any isolated SQL execution.
- Claim v1 returns `pending` to both first and subsequent callers; **use v2 only** after review.
- Claim v2 returns a unique owner token to the first caller, but has no durable lease/recovery or transactional finalize of the linked DM and quota.
- Finalize v1 checks matching Reveal/DM sender and recipient, but does not check `upload_attempt_id`, payload fingerprint, object association or quota reservation. It must be strengthened before use.
- Reconciliation links are nullable and cross-table equality is not enforced. Their ALTER ADD CONSTRAINT statements are not repeatable.
- The reconciliation adapter expects an attempt-linked Reveal and object record, but the draft schema does not guarantee immutable binding or snapshot consistency.
- Storage writes and PostgreSQL writes cannot be committed in one PostgreSQL transaction. A robust orphan/recovery protocol is necessary.
- An earlier schema uses `ON DELETE CASCADE` for the Reveal DM reference; retention/reporting obligations require review before deletion.
- RLS, service-role execution context, cost controls, cross-user blocks and Secret Letters DM eligibility require isolated verification.

## Minimum next isolated gate
Create a corrected, consolidated schema **in a disposable test database** and run PostgreSQL parser/dependency tests. Follow with transactional claim/finalize tests, concurrent uploads, quota reservation/refund, uncertain network outcomes, and authenticated Storage Range checks. No live data or production credentials.

**Production remains blocked** until explicit approval, tested rollback and independent security review.
