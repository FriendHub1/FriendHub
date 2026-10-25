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
