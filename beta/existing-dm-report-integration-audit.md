# Verified existing DM report integration (index.html audit)

Read directly from the branch's index.html blob dc017c672fe62ca768d6a11ed81db3b9b9fa5d97.

## What exists now
- The current DM reporting overlay has id `xoxoDmReportOverlay`, form `xoxoDmReportForm`, reason select `xoxoDmReportReason`, details textarea `xoxoDmReportDetails`.
- Reasons: harassment, spam, inappropriate, threats, other.
- The existing handler selects a received message from `window.__xoxoCurrentDmMessages` and inserts into `public.direct_message_reports` with `message_id`, `reporter_id`, `reason`, `details`.
- The existing panel includes a separate read-only conversation moderation viewer using `xmm-conversation-list` and `xmm-message-list` classes.
- The existing single-message report behavior and records must remain functional.

## Decision
**Extend, do not replace.** Keep the existing message-report flow. Introduce an optional conversation-report action in the same DM experience, selecting 1–20 messages. The new action uses the authenticated BETA pipeline and a future server RPC; it must not insert multiple individual `direct_message_reports` records to simulate one conversation report.

## Admin experience
- Reuse the existing full-conversation moderation viewer, with a report entry linked to the same two participants.
- Mark selected evidence IDs distinctly when a report is opened, without granting broader access through the reporting endpoint.
- Avoid a duplicate full-conversation viewer.
- Verify the exact existing admin report query and PIN authorization before wiring new report records.

## Release blockers
- RPC and BETA report/evidence tables do not exist yet.
- Need database transaction, RLS/security checks, rate limiting, idempotency, evidence retention policy, and live tests.
- Do not modify the 5.1MB index.html blindly or deploy production without explicit approval.

Status: code audit and integration decision only; no production changes.
