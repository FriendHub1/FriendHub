# Conversation report: integration acceptance checklist (BETA)

## Submit
- [ ] Signed-in reporter derived from verified JWT, not request body
- [ ] Validate reason code, optional details (max 2000 characters), peer UUID
- [ ] Accept 1–20 **unique** selected message UUIDs only
- [ ] Check each message belongs to reporter/peer pair and is currently visible under user-scoped RLS
- [ ] Reject cleared, expired or otherwise inaccessible evidence
- [ ] Atomic report + evidence insertion; rollback on any failure
- [ ] Rate-limit submissions and enforce idempotency by reporter and request key
- [ ] Confirm report ID only after successful commit

## Moderator
- [ ] Require verified admin identity and active moderation PIN gate
- [ ] Only show explicitly selected messages (not the entire DM)
- [ ] Audit every evidence access
- [ ] Define retention for deleted messages and expiring whispers before enabling snapshots

## UX
- [ ] Explain to reporter exactly which messages are shared with moderators
- [ ] Show loading, success, invalid evidence, retry and rate-limit states
- [ ] Do not imply success if submission fails
- [ ] Validate translations in all supported interface languages

## Release gate
- [ ] Run all `beta/test-*.cjs` suites successfully
- [ ] Review RLS, grants, server logs, privacy policy and data retention
- [ ] Exercise end-to-end with two test accounts and admin
- [ ] Obtain explicit approval before applying schema or deploying production

Status: planning checklist only; **no live SQL or production deployment**.
