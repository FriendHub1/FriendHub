# XOXO Reveal · DM integration (BETA, not deployed)

## Verified from user's full index.html
- DM send handler: `sendDirectMessage(event)`.
- Current recipient: `currentDmUserId`; sender: `currentUser.id`.
- Chat composer: `dmInput`; send control: `dmSendButton`.
- Existing DM data table: `direct_messages`; unread count queries `recipient_id`, `is_read`.
- Existing Admin uses `xoxoMagicBoxStudioOpen` and its `magicbox` tab.
- The standalone sender/recipient demo is **not** a real messaging implementation.

## Proposed protected delivery
1. Sender selects photo/video and duration (once / 5 / 10 / 15 / 20 seconds / keep in chat).
2. Upload media to a **private** Supabase Storage bucket with short-lived access. Do not store public URLs or media bytes in `direct_messages`.
3. Server creates a Reveal record bound to sender ID, recipient ID, DM ID, mode, storage object key, and state. Enforce ownership and recipient permissions via RLS / server auth.
4. Recipient receives a safe DM card with opaque Reveal ID and no preview URL. Slider must reach 100% before requesting a one-time access token.
5. A server-side atomic open operation checks recipient, expiry, single-open semantics and issues a very short-lived access path; never expose service-role credentials.
6. Count down only after image loaded / video playback begins. Expire server-side; delete storage object when appropriate. Do not rely on browser timer for security.
7. Keep mode requires explicit persistent storage behavior and separate privacy/retention rules.
8. Moderation and abuse-report access must remain possible under documented policy, without exposing content to unauthorized users.
9. Block screen-capture **claims**: screenshots and external recording cannot be reliably prevented.

## Implementation gates
- Inspect the actual `direct_messages` schema, current storage policies and RLS before any migration.
- Decide whether to use a separate `xoxo_reveals` table with DM linkage; do not assume existing columns.
- Test two non-admin accounts in branch-only environment; do not test likes between admin and alternate account.
- Confirm existing DM, notifications, attachments, and Admin behavior remain unchanged.
- Obtain explicit approval before migrations, production deployment, merging PR #2, or changing Supabase policies.

## Current status
Design demo approved by user. Real DM delivery **not yet implemented**. This file is an integration specification for safe work on the isolated branch.
