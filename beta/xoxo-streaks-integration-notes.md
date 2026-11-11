# XOXO Streaks — BETA integration status

Branch: `feature/xoxo-streaks-beta` · Draft PR #17.

## Implemented in this branch
- Localized streak card module: `beta/xoxo-streaks.js`.
- Opt-in host bridge: `beta/xoxo-streaks-chat-bridge.js`. It rechecks the current account/chat after async refresh and clears stale UI on context changes.
- Added explicit stale-response guards to prevent a previous chat's RPC response from painting the card after the user switches conversations.
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
1. The isolated BETA build now injects a loader into its generated copy of `index.html`; production `index.html` is not modified.
2. `beta/xoxo-streaks-beta-host.js` creates a mount at the top of `#dmChat` only on the dedicated `workers.dev` host when `?xoxo_streaks_beta=1` is present. It supplies live getters for the authenticated client, account ID, peer ID, locale and mount.
3. The host checks chat visibility and context changes, refreshes when the loaded message list changes, and clears on sign-out/chat close. Admin view is excluded.
4. Review the server-side `dm_conversation_clears` filter: the proposed RPC now applies the signed-in user's own clear timestamp, excludes that UTC day and earlier activity, and does not reset the other participant's separate view. The aggregation is daily, so same-day activity cannot be safely distinguished around a clear; test and approve this behavior before release.
5. Verify exact `direct_messages` column types, trigger interactions and RPC behavior on a disposable Supabase project before applying the SQL there.
6. Test UTC midnight boundaries, a missing mutual day, 3/7/14/30/100-day milestones, account switching, blocked/cleared conversations, and disappearing content.
7. Confirm the latest GitHub Actions run passes and conduct browser E2E tests in the isolated BETA Worker. The new workflow validates the bundle and runs a Wrangler dry-run; deployment is separately gated by `XOXO_STREAKS_BETA_DEPLOY_ENABLED=true` and dedicated `XOXO_STREAKS_BETA_CF_API_TOKEN` / `XOXO_STREAKS_BETA_CF_ACCOUNT_ID` environment secrets.

## Safety status
- No change has been made to the source `index.html` or `main`; the build script injects the loader into `.xoxo-streaks-beta-dist/index.html` only.
- The SQL has not been executed against Supabase.
- The bridge is opt-in and does not patch global chat functions.
- The RPC does not assume a particular block-table name; the BETA host must enforce the existing block rules before showing a streak.
- The proposed RPC now scopes conversation-clear filtering to the signed-in user, rather than letting one participant's local clear reset the other person's view.
- Do not merge or deploy until integration, database and browser checks pass.


## Isolated BETA packaging added
- `wrangler.streaks-beta.jsonc` targets a separate Worker named `xoxo-streaks-beta`.
- `beta/build-streaks-beta-assets.sh` builds a restricted public asset bundle and injects the loader into the BETA copy only.
- `.github/workflows/xoxo-streaks-beta-deploy.yml` runs contract tests and a Wrangler dry-run. Actual deployment remains gated until the dedicated BETA environment is configured and explicitly enabled.
- Preview URL format after deployment: `https://xoxo-streaks-beta.<your-account-subdomain>.workers.dev/?xoxo_streaks_beta=1`.
