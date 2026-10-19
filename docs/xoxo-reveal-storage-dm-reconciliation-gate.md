# XOXO Reveal BETA — Storage / DM / quota reconciliation contract

**Status: REVIEW ONLY. No deployment or production writes.**

The isolated PostgreSQL refund v2 tests passed, but a PostgreSQL transaction
cannot atomically prove that a Supabase Storage object does not exist. Therefore
the current `xoxo_reveal_release_quota_v2` draft must NOT be called by a
production refund worker. `status='failed'` and no linked Reveal are
insufficient proof of absence.

## Required trusted identity chain

1. Authenticate the sender from the server-verified access token; never accept
   `sender_id` as authority from the browser.
2. Resolve the upload attempt by `(sender_id, request_key)`; compare the
   server-calculated fingerprint of the canonical validated payload.
3. Bind the Reveal using `xoxo_reveals.upload_attempt_id` and its exact
   `payload_fingerprint`. Check DM ID, sender, recipient and mutual blocks
   using the live DM authorization policy before linking.
4. Bind quota using `xoxo_reveal_quota_reservations.upload_attempt_id` and
   matching sender; do not accept a reservation ID alone.
5. Resolve the Storage path from server-owned
   `xoxo_reveal_upload_objects.attempt_id`, not from request input. Validate
   bucket, sender, fingerprint, object identity and trusted Storage metadata.

## Fail-closed decision matrix

| Storage | Linked DM/Reveal | Quota | Outcome |
|---|---|---|---|
| present | present and matching | reserved | Verify then finalize existing result; never refund |
| present | absent | reserved | Orphan candidate; quarantine and reconcile, no immediate refund |
| absent | present | reserved | Inconsistent delivery; manual reconciliation, no refund |
| absent | absent | reserved | Refund candidate only after a durable write fence and fresh authoritative recheck |
| unknown | any | any | No destructive action |
| any | unknown | any | No destructive action |
| any | any | unknown | No destructive action |
| absent | absent | released | Close only if the original release is proven; never refund twice |

## Atomicity boundary

The future server worker must acquire an attempt-scoped durable fence so
concurrent upload, finalize and refund workers cannot proceed independently.
A PostgreSQL transaction must lock the attempt and quota rows in a consistent
order. **A SQL row lock alone does not fence an in-flight Storage upload.**
A separate durable upload state / lease and reconciliation protocol must
guarantee that no Storage writer remains active before the final Storage check.
After fresh trusted Storage and DM reads, perform the quota update while the
database locks remain held. On ambiguous network or commit outcome, record
`needs_reconciliation`, not success.

The current `refund-isolated-transaction-executor.mjs` is only a contract
for injected test transactions. Its caller assertions do not establish a real
Supabase fence, and its success must never be treated as deployment readiness.

## Blocking acceptance tests

- Storage upload commits, then HTTP response is lost.
- DM link commits, then response is lost.
- Two workers race to finalize/refund the same attempt.
- Object deletion races with a refund decision.
- Storage timeout/403/404 cannot be mistaken for authoritative absence.
- Recipient/sender mismatch, revoked DM permission, and mutual blocks.
- Duplicate request key with altered bytes, mode or recipient.
- Browser never receives service-role credentials or private object paths.
- Audit retention, orphan cleanup, Storage Range/Safari, billing and timer UX.

**No real-media smoke test and no deployment until an isolated Supabase
environment and the durable cross-service fencing protocol are approved.**
