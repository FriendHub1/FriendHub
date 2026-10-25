# BETA database integration: verified schema and deployment blockers

Verified read-only against project cxosofpxfmjkrhfabrqc on 2026-10-24.

## Actual database
- public.direct_messages exists with id, sender_id, recipient_id (uuid), content, whisper_id, attachment metadata, and other fields.
- public.xoxo_conversation_reports_beta **does not exist**.
- public.xoxo_conversation_report_evidence_beta **does not exist**.
- A DM conversation is identified by its two participant IDs, not a conversation_id column.

## Integration blockers
1. Approve and review the proposed schema before applying any DDL.
2. Implement an atomic, authenticated submission endpoint with server-side authorization and replay protection.
3. Decide how evidence should survive deletion while honoring expiring whispers and once-view media.
4. Limit admin evidence retrieval to selected messages and require admin/PIN verification and access logging.
5. Verify RLS, rate limiting, tests, privacy policy and retention rules before production.

## Current safe behavior
- BETA preparation and orchestration modules do **not** persist data.
- Never use a privileged service-role client to run a user-visible message preflight.
- Never treat a successful local preflight as sufficient server authorization.
- Do not enable public direct inserts into the proposed report/evidence tables.

This file documents observed schema only; no SQL changes were applied.
