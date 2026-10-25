# Stay Safe, Sweetheart! — BETA integration wiring contract

**Status: code prepared in GitHub only. This file does not deploy changes.**
Scope: `FriendHub1/FriendHub`, `feature/xoxo-safety-reminder-beta`.
Never run the SQL draft against production without approval and an independent security review.

## Verified integration points in the existing index.html

Inspected index.html blob `dc017c672fe62ca768d6a11ed81db3b9b9fa5d97`:

- Current user: `currentUser?.id`.
- Current DM peer: `currentDmUserId`.
- Already loaded and visible DM rows: `window.__xoxoCurrentDmMessages`.
- Supabase user-scoped client: `supabaseClient` (must not be service role).
- Existing admin reports: `xmmReportsList`, `loadXoxoDmReports`, `renderXoxoDmReports`.
- Existing moderator conversation view: `openXoxoDmConversation(c)`.
- PIN/reason guard: `xoxoModerationPinAuthorize(es)`.
- Audited message read RPC called by that viewer: `xoxo_admin_read_dm_page_pin`.

**Do not introduce another DM viewer** or perform DM admin reads through the BETA adapter.

## Browser scripts (not yet wired)

Load these four scripts in the BETA page, in this order:

1. `beta/stay-safe-sweetheart.js`
2. `beta/stay-safe-report-form.js`
3. `beta/stay-safe-evidence-picker.js`
4. `beta/stay-safe-browser-bridge.js`

Confirm the Worker static-asset routing serves these files in BETA; the current production page does not import them.

Construct a bridge once per authenticated page session:

```js
const safetyBridge = window.XOXOStaySafeBridgeBeta.create({
  getClient: () => supabaseClient,
  getVisibleMessages: () => (window.__xoxoCurrentDmMessages || []).map(m => ({
    id: m.id,
    sender_id: m.sender_id,
    recipient_id: m.recipient_id,
    text: m.content || "",
    attachment_type: m.attachment_type
  })),
  onResult: result => {
    // Connect to the site's existing visible toast/feedback mechanism.
    // A report succeeds only when result.ok === true.
    // Do not send details or private message content to analytics.
    console.info("Safety BETA result:", result.ok ? "success" : result.reason);
  }
});

function xoxoSafetyCurrentDmContext() {
  const accountId = currentUser?.id;
  const otherUserId = currentDmUserId;
  if (!accountId || !otherUserId || accountId === otherUserId) return null;
  return {
    accountId,
    otherUserId,
    // Stable in either user order; scoped further by account in localStorage.
    conversationId: [accountId, otherUserId].sort().join(":"),
    locale: getFriendHubLanguage()
  };
}

// On opening a DM, after current user and peer IDs are set:
const context = xoxoSafetyCurrentDmContext();
if (context) safetyBridge.showSafetyNotice(context);

// From a NEW "Report conversation" action in the existing DM chat:
const currentContext = xoxoSafetyCurrentDmContext();
if (currentContext) void safetyBridge.startReport(currentContext);
```

The warning is browser-local once per conversation per account. It should not
appear repeatedly during chat updates. The new "Report conversation" action must
remain accessible even after the user dismisses the warning.

The report UI gathers a reason (0–5), optional details (max 2000), and 1–20
explicitly selected evidence IDs. The BETA bridge rechecks authentication,
selected IDs and RLS visibility using the user-scoped Supabase client.
**Security is enforced independently by the server RPC draft**; a browser
preflight is not sufficient.

**Do not enable the submission button** until
`public.xoxo_submit_conversation_report_beta` has been installed and audited
in a separate approved environment.

## Existing admin panel: metadata only, with PIN

Additional BETA-only script: `beta/stay-safe-admin-report-adapter.js`.

After the existing moderation PIN session has been verified, use the existing
admin reports list, not a new admin route:

```js
const result = await window.XOXOSafetyAdminAdapterBeta.load({
  client: supabaseClient
});
// result.ok === true: result.rows has BOTH old single-message reports and
// new conversation-report metadata, differentiated by report.kind.
// result.ok === false && result.legacyRows: keep existing reports on-screen;
// show a warning that the new BETA queue is not available.
```

Adapt the existing `renderXoxoDmReports` to display:
- `report.kind === "single_message"`: existing report functionality unchanged.
- `report.kind === "conversation"`: report reason, participants, timestamp,
  status and `report.evidenceIds.length` selected evidence IDs. The adapter
  never returns private DM contents.
- Buttons changing status should call
  `XOXOSafetyAdminAdapterBeta.updateStatus({client:supabaseClient,report,status})`
  so each report type uses its correct existing/new RPC.
- For conversation reports ONLY, add an "Open existing conversation" button
  that calls
  `XOXOSafetyAdminAdapterBeta.openInExistingViewer(report, openXoxoDmConversation)`.
  This delegates to the **existing PIN + reason prompt, audited, paginated DM
  viewer**. A successful handoff does not prove the PIN prompt was completed.

The new admin metadata RPC itself also requires a valid PIN verification
session. Do not bypass the PIN or replace the moderator RPC with direct reads.

## Localization verified against real site selector

Supported UI locales from index.html:
`en, es, pt-BR, de, nb, pl, fr, cs, sv, it`.
The safety modules normalize Norwegian `nb` to `no`.
Warning, report form, and evidence picker now provide all ten locales,
including Swedish and Italian. The six reason codes retain identical order
across locales.

## Release blockers

1. Proposed BETA SQL has NOT been installed in Supabase. Audit it and test in a non-production database, including RLS visibility after conversation clears.
2. Privacy/retention approval is pending. The SQL draft stores IDs and minimal metadata, NOT copies of messages or attachments. A physically deleted message may no longer be available in the existing moderator viewer.
3. UI and admin bindings described above are not yet in index.html; no live notification, sent report or admin display can be claimed.
4. Execute the new `beta/test-*.cjs` tests in CI and real authorized/unauthorized account tests before any release.
5. Validate the six reasons, evidence picker, keyboard/mobile behavior, ten locales, and existing PIN workflow in a BETA deployment.
