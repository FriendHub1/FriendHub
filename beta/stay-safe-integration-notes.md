# Stay Safe, Sweetheart! — integration checklist

Status: isolated BETA prototype only. Do not deploy to production.

## Trigger
After chat conversation ID and authenticated user ID are available, call:
```js
window.XOXOSafetyReminderBeta?.show({
  conversationId: conversation.id,
  accountId: currentUser.id,
  locale: currentLocale
});
```
Only on first entry to each distinct chat; localStorage currently remembers acknowledgement on this device/browser. Cross-device persistence requires a dedicated backend record with appropriate RLS. Do not use a username as a stable identifier.

## Before release
- Identify the existing chat opening handler in index.html; avoid duplicate overlays.
- Provide translations for all **10** currently supported locales, using the application's real locale codes. The prototype currently includes English and Spanish, with English fallback.
- Review keyboard focus trapping, Escape behavior and accessibility.
- Use the existing moderation API for explicit user-selected message reports only. Do not send entire private conversations by default. Add server-side authorization and audit logging.
- Make reporting available independently of whether the reminder has been dismissed.
- Verify no message text is logged or sent by the reminder itself.
- Test on iPhone Safari and desktop; ensure keyboard and scroll behavior.
- Only after approval, include the script in the beta page and wire it to the chat lifecycle.

## Verified from current index.html
- Direct chat entry point: `async function openDirectChat(userId, username, profilePhoto = "")` (actual declaration includes `async`).
- Authenticated user: `currentUser.id`; recipient: `currentDmUserId`.
- Current locale getter: `getFriendHubLanguage()`.
- Exact 10 locale values: `en`, `es`, `pt-BR`, `de`, `nb`, `pl`, `fr`, `cs`, `sv`, `it`.
- The opt-in wrapper is in `beta/stay-safe-chat-hook.js`. Do not load it until translations, report flow, and BETA integration are reviewed.

## Verified DM entrypoint (main branch inspected 2026-10-24)
The actual entrypoint is `async function openDirectChat(userId, username, profilePhoto = "")` in `index.html`. It sets `currentDmUserId = String(userId)`, calls `openMessagesPage()`, then makes `#dmChat` visible. The current user is `currentUser.id`. The current locale helper is `getFriendHubLanguage()`.

**Suggested BETA hook after the chat becomes visible:**
```js
window.XOXOSafetyReminderBeta?.show({
  conversationId: [String(currentUser.id), String(currentDmUserId)].sort().join(":"),
  accountId: String(currentUser.id),
  locale: getFriendHubLanguage()
});
```
Use the sorted user pair only if DMs are one-to-one. Confirm against backend schema before release. This is a client-only acknowledgement: another browser will show the notice again.

**Important discrepancy:** The inspected `getFriendHubLanguage()` currently recognizes `es`, `pt-BR`, `pl`, `fr`, `nb`, `de`, `cs`, plus English fallback: eight locale codes. The owner reports ten live languages. Discover the other two from the latest application source before adding translations; do not guess.

The 5MB `index.html` was retrieved via GitHub blob SHA after the file-range fetch returned empty content. Do not overwrite the huge file without validating the latest branch blob and testing a precise patch.
