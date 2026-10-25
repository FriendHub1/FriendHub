# XOXO Avenue — secure reporting integration contract (BETA)

## What exists
- `stay-safe-sweetheart.js`: opt-in safety reminder UI.
- `stay-safe-report-form.js`: reason and optional details; passes structured input to host.
- `stay-safe-evidence-picker.js`: explicitly checked message IDs; no network calls.

## Required host integration (not implemented)
1. Determine the authenticated reporter's user ID on the server. Never accept a reporter ID supplied by browser JS.
2. Confirm reporter is a participant in the conversation.
3. Fetch only messages the reporter is authorized to view. Display those in the evidence picker.
4. Accept selected IDs (up to 20), and on the server recheck that every ID belongs to that same conversation and is visible to the reporter.
5. Store report reason as a stable code (0–5), optional details (max 2000 characters), and a server-side snapshot of selected evidence. Use a transaction or equivalent atomic operation.
6. Only privileged moderators can read reports/evidence, using existing moderator authorization and RLS. Do not grant public access or send all messages automatically.
7. Prevent duplicate submission via idempotency key, enforce per-user rate limits, and keep an audit trail of moderator access.
8. Return a success acknowledgement only after the backend confirms persistence. Do not display success based solely on the frontend callback.
9. Define evidence retention, deletion policy and abuse-report handling before deployment.
10. Translate UI in all 10 verified site locales and test keyboard/mobile accessibility.

## Integration sketch (not executable without real host APIs)
```js
XOXOReportFormBeta.open({
  conversationId,
  locale,
  onContinue: ({ conversationId, reasonCode, details }) => {
    XOXOEvidencePickerBeta.open({
      conversationId,
      locale,
      messages: authorizedVisibleMessages,
      onContinue: ({ messageIds }) => {
        // Submit to an authenticated server endpoint that REVALIDATES everything.
        // Do not submit from this isolated prototype.
      }
    });
  }
});
```

**Status:** UI prototypes only. No authenticated report endpoint, evidence persistence, moderation-panel integration or production deployment. Do not claim reports are being received.
