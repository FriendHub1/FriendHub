# Admin moderation integration contract — BETA only

## Preserve existing admin panel
- Keep the existing direct_message_reports moderation functionality and historical reports intact.
- Add a separate "Conversation reports" view or filter in the existing PIN-gated moderation area, not a replacement for existing reports.
- A newly submitted report becomes visible in the admin panel **only after** an authenticated, atomic server-side submission succeeds.
- Report queue fields: report ID, creation time, reporter, reported peer, reason, optional details, status, evidence count.
- Admin can open a report and see only the 1–20 explicitly selected messages, never the entire conversation by default.
- Admin actions: pending, reviewed, resolved, dismissed; every action and evidence read must be audited.

## Access controls
- Reuse the site's actual server-verified admin identity and moderation PIN mechanism. UI-only PIN checks are insufficient.
- Never expose the report queue, reporter identity, or evidence through a public SELECT policy.
- Restrict evidence retrieval to the report's stored selected IDs, verify admin access on every request, and avoid using a user-scoped client with escalated permissions.
- Preserve existing report records and statuses; do not modify direct_message_reports to support this feature.

## Deleted and expiring content
- Retention policy is not decided. Do not promise deleted or expired messages will always be available.
- Never silently preserve disappearing whispers or one-view media as evidence without an explicit privacy and retention design.
- If evidence is no longer available, show an honest unavailable state rather than revealing unrelated messages.

## Release acceptance
- Verify both old and new report queues in admin with test accounts.
- Confirm that non-admin accounts and admins without valid moderation authorization cannot access evidence.
- Confirm that admin evidence access creates an audit event.
- Do not enable production without approval and verified tests.

Status: specification only. No production admin UI, database, or server changes.
