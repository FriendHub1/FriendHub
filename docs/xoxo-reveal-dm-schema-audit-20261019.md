# XOXO Reveal — DM and administrator authorization audit (2026-10-19)

**Status: BLOCKED — review only, not deployed.**

## Repository evidence

- `docs/xoxo-reveal-dm-integration.md` records a previous inspection of the full application: `sendDirectMessage(event)`, `currentDmUserId`, `currentUser.id`, and `direct_messages` with `recipient_id` / `is_read`. These are integration hints, **not** an audited database schema.
- The branch's root `index.html` and `worker.js` do **not** contain `sendDirectMessage`, `direct_messages`, `blocked_users`, or `is_xoxo_admin` as literal strings. Thus these checked-in files do not currently establish the live authorization model.
- `supabase/migrations/20261019_xoxo_reveal_reconciliation_admin_v1_REVIEW_ONLY.sql` intentionally denies all admin lookups. This is appropriate until a privileged, server-owned admin membership source is verified.
- No verified schema/policy for DM participants, blocks, or server-side administrator membership was established by this audit.

## Release-blocking evidence required

1. Obtain the actual current `direct_messages` table definition, RLS policies, and foreign keys from the **authorized environment**, without changing data.
2. Identify the authoritative conversation/recipient relationship and both-direction blocking rules, including unfriend/unmatch behavior and deleted accounts.
3. Identify server-owned admin membership and determine whether `is_xoxo_admin` is a zero-argument, caller-dependent function. Do **not** evaluate a client-side role flag as administrator authority.
4. Design a privileged DM authorization function that binds **authenticated sender, recipient, and specific DM** and fails closed on missing/deleted/blocked relationships.
5. Add isolated database tests for unauthorized sender, wrong recipient, blocked users in either direction, stale/deleted DM, and admin impersonation.
6. Only after evidence and tests, consider implementing the privileged DM and reconciliation-admin RPCs.

## Safety decision

Do not guess a table name for blocks or grant access from the UI state. Do not deploy the draft SQL or claim production readiness. A separate unresolved blocker remains: an external Storage upload may continue after a timeout or lost lease; PostgreSQL writer ownership alone cannot stop that in-flight write.

## Read-only connected Supabase schema inspection (2026-10-19)

Connected project: `FriendHub1's Project` (`cxosofpxfmjkrhfabrqc`), **read-only metadata inspection only**. No rows, secrets, or user messages were fetched or modified.

- `public.direct_messages` exists with UUID `id`, `sender_id`, `recipient_id`, `reply_to_message_id`, `media_opened_by`; text `content`, `attachment_path`, `attachment_type`, `attachment_name`, `media_view_mode`; integer `media_view_seconds`; bigint `attachment_size`; boolean `is_read`; and relevant timestamps. Its RLS is enabled.
- `public.user_blocks` exists with UUID `blocker_id`, `blocked_id` and `id`; RLS enabled. A trusted DM authorization check must reject blocks **in either direction**.
- `public.message_requests` exists with UUID `sender_id`, `recipient_id` and text `status`; RLS enabled. Do not assume which statuses grant DM access without inspecting current policies.
- `public.xoxo_admins` exists with UUID `user_id` and `created_at`; RLS enabled. The metadata listing reported zero rows, so existence of the table **does not establish** a valid current admin membership or authorize any reviewer.
- `public.profiles` contains UUID `user_id` and `id`. Distinguish these identifiers in joins and membership checks.

**Remaining audit:** inspect current RLS policy definitions, constraints and any authorization functions, then implement server-owned DM authorization against actual rules with isolated negative tests. Do not enable the admin-review RPC solely from the table name. The existing BETA `xoxo_reveals` / upload objects are still review-only and were not deployed.


## Actual RLS policies audited read-only (2026-10-19)

The connected database's `pg_policies` establishes:

- `direct_messages` INSERT requires `auth.uid() = sender_id`, distinct sender/recipient, `xoxo_has_existing_dm_or_acceptance(sender_id,recipient_id)`, no `user_blocks` row in **either direction**, and the Secret Letters beta matching/previous-DM condition. This is the closest currently verified authorization rule for Reveal DM sends; **do not** replace it with a mere participant check.
- `direct_messages` SELECT is restricted to sender or recipient. UPDATE policies permit the sender to edit and recipient to mark read.
- `message_requests` INSERT rejects either-direction blocks and uses `sl_is_beta_tester` / `sl_users_are_matched`; SELECT permits participants.
- `user_blocks` SELECT exposes only the blocker's own blocks to an authenticated user. Thus an ordinary browser-side query **cannot reliably detect when the other party blocked the sender**. A privileged server check is required.
- `xoxo_admins` SELECT permits only a user's own membership row; the table had zero rows in the metadata listing. **Do not grant reviewer rights** until server-owned admin membership is established.

**Important:** These are policy expressions observed at audit time, not an authorization RPC implementation. Next: inspect definitions/permissions for `xoxo_has_existing_dm_or_acceptance`, `sl_is_beta_tester`, `sl_users_are_matched` and decide how to safely reuse the rules in a privileged function with isolated tests. Production database was not modified.

## Read-only inspection of authorization helper definitions (2026-10-19)

- `xoxo_has_existing_dm_or_acceptance(p_sender uuid,p_recipient uuid)` is `STABLE SECURITY DEFINER`, uses an empty `search_path`, and returns true if a `direct_messages` row exists in either direction **or** an `accepted` `message_requests` row exists in either direction. It does **not** itself check blocks, authenticated identity, or deleted accounts.
- `sl_is_beta_tester(p_user_id uuid)` is `STABLE SECURITY DEFINER` and checks `sl_beta_testers` membership.
- `sl_users_are_matched(p_user_a uuid,p_user_b uuid)` is `STABLE SECURITY DEFINER`, requires `auth.uid()` to be one of the two users and an existing `sl_conversations` row with `status='matched'` in either direction. **Critical:** calling it through a privileged service-role context without the end user's JWT can yield false even for matched users. Do not blindly call this helper in service-role Reveal authorization.
- The current `direct_messages` INSERT RLS contains an additional Secret Letters condition, but because it also requires `xoxo_has_existing_dm_or_acceptance`, the latter is the necessary permission gate for every currently permitted send. The Secret Letters clause becomes true via the same helper once that gate passes. A trusted Reveal authorization check should independently verify the authenticated sender, target recipient, both-direction blocks, and this existing-DM/accepted-request relationship; never accept a caller-supplied boolean.
- A persisted DM row alone can establish the **historical** relationship, but cannot prove a new send is currently allowed if either user blocked the other. Server-side authorization must re-check the blocks at the point of send/finalize.
- No live schema or function was changed. This is a snapshot of current definitions; integration remains review-only.

