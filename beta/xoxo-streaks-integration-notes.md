# XOXO Streaks — chat integration notes

The module and proposed SQL are on `feature/xoxo-streaks-beta`. They are not yet active on the website.

Verified integration names from the existing chat:
- Authenticated Supabase client: `supabaseClient`
- Signed-in user: `currentUser.id`
- Current conversation peer: `currentDmUserId`
- Language: `getFriendHubLanguage()`
- Chat message rendering: `renderDirectMessages(messages)`
- Message loading: `loadDirectMessages()`

Expected mount lifecycle:
1. Add a dedicated `<div id="xoxoStreaksMount"></div>` in the current DM header area.
2. Load `/beta/xoxo-streaks.js` only in the isolated BETA build.
3. On each conversation open, destroy the previous instance and create a new instance with the current authenticated client, `currentUser.id`, `currentDmUserId`, `getFriendHubLanguage()`, and the mount element.
4. Call `refresh()` when opening the chat and after a message is successfully sent/received.
5. Destroy and clear the card when leaving the chat or changing accounts.
6. Apply `beta/xoxo-streaks-schema.sql` only to an isolated test project first, then verify RLS, blocked users, UTC boundaries, disappearing media exclusions and day transitions.

Do not merge or deploy to production until the host integration and database RPC have been tested end-to-end. The proposal SQL has not been executed.
