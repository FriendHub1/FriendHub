# Stay Safe, Sweetheart! — BETA host integration contract

Branch: feature/xoxo-safety-reminder-beta
Status: code-only. No production or Supabase deployment.

## Verified real index.html integration points

- supabaseClient is the existing user-scoped client.
- currentUser.id and currentDmUserId are the two DM participants.
- getFriendHubLanguage() returns locale; Norwegian uses nb.
- renderDirectMessages(messages) writes window.__xoxoCurrentDmMessages.
- loadDirectMessages() loads the current conversation under existing RLS.
- loadXoxoDmReports() renders individual-message reports in #xmmReportsList.
- xoxoModerationPinAuthorize(isSpanish) runs the existing PIN prompt.
- openXoxoDmConversation(c) is the EXISTING audited full-conversation viewer.
  It prompts for PIN and a reason, then calls xoxo_admin_read_dm_page_pin.
- xoxoDmConversations is the admin's current conversation list.

## Browser scripts — required load order

1. /beta/stay-safe-sweetheart.js
2. /beta/stay-safe-report-form.js
3. /beta/stay-safe-evidence-picker.js
4. /beta/stay-safe-browser-report-adapter.js
5. /beta/stay-safe-browser-flow.js
6. /beta/stay-safe-admin-reports-bridge.js (admin only)

These files are NOT loaded by index.html yet. Cloudflare's assets.directory is
"./", but confirm the actual JavaScript responses in a BETA preview before
injecting script tags; SPA fallback HTML must not be mistaken for JS.

## Chat lifecycle wiring (example only; NOT active)

    function xoxoCreateSafetyBetaFlow() {
      if (!currentUser?.id || !currentDmUserId || !window.XOXOSafetyFlowBeta) return null;
      const ids = [String(currentUser.id), String(currentDmUserId)].sort();
      return window.XOXOSafetyFlowBeta.create({
        client: supabaseClient,
        accountId: currentUser.id,
        otherUserId: currentDmUserId,
        conversationId: ids.join(":"),
        locale: getFriendHubLanguage(),
        getMessages: () => window.__xoxoCurrentDmMessages || [],
        enabled: false, // DO NOT enable before server-side RPC audit
        onStatus: result => {
          // Only announce success when result.ok === true.
          // Do not log private messages.
        }
      });
    }

After the current conversation renders:

    xoxoCreateSafetyBetaFlow()?.showReminder();

Add a user-triggered "Report conversation" action to the current DM header/menu
that calls xoxoCreateSafetyBetaFlow()?.openReport(). This is separate from the
existing single-message openXoxoDmReport(messageId) option, which is preserved.

## Admin moderation integration (example only; NOT active)

After the existing renderXoxoDmReports() finishes, append to the SAME
#xmmReportsList container via the BETA bridge. Never replace the existing
render or create a new DM viewer.

    const bridge = window.XOXOAdminConversationReportsBeta?.create({
      client: supabaseClient,
      locale: getFriendHubLanguage(),
      // Return the existing PIN dialog's {reason}, not just true/false.
      // Every BETA admin RPC requires this auditable moderation reason.
      onUnlock: async () =>
        await xoxoModerationPinAuthorize(getFriendHubLanguage() === "es"),
      onOpenConversation: async ({user_1,user_2}) => {
        const matches = c =>
          (String(c.user_1) === user_1 && String(c.user_2) === user_2) ||
          (String(c.user_1) === user_2 && String(c.user_2) === user_1);
        let entry = xoxoDmConversations.find(matches);
        if (!entry) {
          // Refresh using the existing conversation-list loader, then recheck.
          // Confirm loader name before editing index.html.
          throw new Error("Conversation not loaded in current moderation list");
        }
        await openXoxoDmConversation(entry);
      },
      onError: reason => { /* display generic admin feedback */ }
    });
    if (bridge) await bridge.attach(document.getElementById("xmmReportsList"));

The bridge fetches ONLY new conversation-report metadata and uses the existing
server PIN gate. The existing full-message viewer still requires its own
verified PIN, moderation reason and access-log insert.

## Tests and remaining release gates

- BETA module code includes auth preflight, validated 1–20 evidence IDs,
  explicit feature disable flag, safe same-key retries, and 10 languages.
- New admin bridge reuses #xmmReportsList, never queries DM content itself,
  and uses a separate status RPC without modifying individual-message reports.
- Supabase BETA SQL was installed with owner approval on 2026-10-25;
  beta/stay-safe-conversation-reports-schema.sql is the reviewed source.
  The live allowlist is empty and reporting remains disabled for the public.
  Run beta/sql-postinstall-safety-gate-readonly.sql before adding any testers.
- Confirm rate limit (draft: 10 reports/24h), retention policy and evidence
  survival if a direct_messages row is physically deleted.
- Validate on an isolated Supabase test project as reporter, unrelated user,
  account-switching user, and PIN-verified/unverified admin.
- Verify GitHub Actions and complete browser E2E tests before any deployment.
