# XOXO Reveal BETA — sealed Storage writer release contract (review only)

**Status:** Design and acceptance criteria; no production implementation, migration, or deployment.

The recipient-bound pipeline now composes authentication, immutable media snapshot, recipient-and-metadata-bound SHA-256 fingerprint, claim RPC, an injected `prepareSealedUpload` writer, and one atomic DM+Reveal RPC. **The writer remains a release blocker.** Passing mocked pipeline tests does not establish real Storage safety.

## Required writer input and evidence

The trusted writer receives `attemptId`, `claimToken`, `senderId`, `recipientId`, `payloadFingerprint`, `mediaType`, `mime`, `mode`, `durationSeconds`, and a verified `Uint8Array` snapshot. The client must never supply `objectPath`, sender identity, ownership tokens, or sealed status.

On success, return exactly server-observed evidence including `attemptId`, `senderId`, `recipientId`, `payloadFingerprint`, `objectPath`, `writerState: 'sealed'`, and `uploadUncertain: false`. Do not fabricate sealed evidence from a successful HTTP response alone; the database must record a corresponding sealed attempt and private object.

## Safe write sequence

1. Recheck the attempt's ownership token, recipient binding, and fingerprint against the database. Authorize recipient and both directions of blocking using trusted server-side checks. A valid claim is **not** an authorization to upload indefinitely.
2. Atomically reserve the applicable quota and acquire a unique writer generation/fencing token. Ensure the private object key is generated server-side and unique to that attempt/generation.
3. Record the intent and generation **before** initiating Storage I/O. Set the attempt to writing with the exact object key. Use a private bucket, create-only upload semantics, explicit byte limits and content type, and no overwrite/upsert.
4. After Storage acknowledges success, independently verify the object and DB ownership/generation. Transition to sealed **only if** the same writer still owns the generation, the object matches the intended media, and the attempt is not marked uncertain.
5. The atomic DM+Reveal RPC must recheck the sealed DB attempt, quota, recipient eligibility, private object ownership, and claim token, then insert both records and mark the attempt completed in the same transaction.
6. On timeout, abort, lost lease, network ambiguity, or unknown Storage result, mark the attempt **uncertain** and return no sealed evidence. Do not create the DM. Queue reconciliation for an operator or a proven-safe cleanup procedure.

## Non-negotiable race condition

A database lease expiry **does not cancel an in-flight Storage PUT**. A late PUT from an old writer can succeed after a new writer acquires a lease. Consequently, do not reuse a Storage key across writer generations; never allow a new writer to overwrite the old generation's key. A new writer may proceed only if the previous generation's outcome is conclusively reconciled, or if the protocol formally proves isolation of the previous write. Otherwise return `wait` / `manual_reconciliation` and do not start another write.

Do not delete an object as generic error cleanup after the atomic RPC fails: the transaction outcome might be unknown and a retry might already reference the object. Cleanup must verify authoritative DB state and object generation, and avoid deleting any object referenced by a completed Reveal.

## Acceptance tests before deployment

- Two concurrent requests with the same idempotency key perform at most one Storage PUT and one linked DM insertion.
- Replays with different recipient, bytes, mode or duration are rejected before any Storage write.
- A Storage timeout followed by a late success cannot overwrite a newer writer's object, create duplicate DM rows, or yield a false success response.
- Loss of writer lease during an in-flight PUT yields uncertain/manual reconciliation, never sealed success.
- Failed or ambiguous atomic RPC outcome never triggers unsafe object deletion.
- A blocked, unaccepted, or unauthorized recipient cannot receive a Reveal even if eligibility changed after claim.
- Private bucket and RLS policies prevent clients from reading other users' unexpired or expired objects.
- Real disposable Postgres + isolated Storage emulator/integration tests demonstrate the above; mock-only tests are insufficient.

**Do not expose the current draft HTTP handler or promote this branch until the writer, storage policies, migration ordering, race reconciliation, and full end-to-end review pass.**
