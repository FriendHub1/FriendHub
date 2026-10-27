# XOXO Streaks — BETA integration status

Branch: `feature/xoxo-streaks-beta` · Draft PR #17.

## Implemented in this branch
- Localized streak card module: `beta/xoxo-streaks.js`.
- Opt-in host bridge: `beta/xoxo-streaks-chat-bridge.js`. It rechecks the current account/chat after async refresh and clears stale UI on context changes.
- Proposed server-side migration: `beta/xoxo-streaks-schema.sql`.
- Contract tests and GitHub Actions workflow.

## Verified host names in existing XOXO Avenue code
- Authenticated Supabase client: `supabaseClient`
- Signed-in user: `currentUser.id`
- Current conversation peer: `currentDmUserId`
- Language: `getFriendHubLanguage()`
- Chat rendering: `renderDirectMessages(messages)`
- Message loading: `loadDirectMessages()`
- Rendered messages are exposed as `window.__xoxoCurrentDmMessages`.

## Still required before this can appear in chat
1. In the isolated BETA build only, add a mount element in the existing DM header and load `xoxo-streaks.js` followed by `xoxo-streaks-chat-bridge.js`.
2. Create the bridge with `enabled: true` only in the opt-in BETA path, supplying live getters for the authenticated client, current account ID, peer ID, locale and mount element.
3. Call `refresh()` when a conversation opens and after successful send/receive; call `clear()` when the chat changes; call `destroy()` on sign-out.
4. Verify exact `direct_messages` column types, trigger interactions and RPC behavior on a disposable Supabase project before applying the SQL there.
5. Test UTC midnight boundaries, a missing mutual day, 3/7/14/30/100-day milestones, account switching, blocked/cleared conversations, and disappearing content.
6. Confirm the GitHub Actions run passes and conduct browser E2E tests in the isolated BETA Worker.

## Safety status
- No change has been made to `index.html` or `main`.
- The SQL has not been executed against Supabase.
- The bridge is opt-in and does not patch global chat functions.
- The RPC does not assume a particular block-table name; the BETA host must enforce the existing block rules before showing a streak.
- Do not merge or deploy until integration, database and browser checks pass.
