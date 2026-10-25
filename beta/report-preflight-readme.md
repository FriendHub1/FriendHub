# Authenticated report preflight (BETA)

The helper `authenticatedReportPreflight(client, {otherUserId, messageIds})` reads the current authenticated identity through `client.auth.getUser()`, then checks that all selected evidence IDs belong to the exact direct-message pair and are visible through the **same user-scoped Supabase client**.

Example (illustrative, not deployed):

```js
const result = await authenticatedReportPreflight(userScopedSupabaseClient, {
  otherUserId: peerUuid,
  messageIds: selectedEvidenceUuids,
});
if (!result.ok) return { error: "Evidence not available" };
```

Security limitations:

- The caller must build a **fresh client using the request's authenticated JWT**, never a service-role client. The helper cannot prove how the client was constructed.
- Do not trust a browser-provided user ID, message body, sender, or attachment URL.
- This is a **read-only preflight**, not a server-authoritative permission grant. Repeat checks within the trusted report submission path before saving.
- Respect `dm_conversation_clears` and the RLS policy on `direct_messages`; never bypass RLS for evidence selection.
- Explicitly exclude expired whispers and other disappearing content where applicable.
- Add atomic storage, rate limiting, idempotency, admin authorization, and audit logging before production.

No endpoint, report insert, or production integration is implemented by this file.
