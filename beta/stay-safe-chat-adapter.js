/* XOXO Avenue — isolated BETA DM lifecycle adapter.
 * Not included by index.html yet. Load after stay-safe-sweetheart.js.
 * Explicitly call XOXOSafetyChatBeta.onChatOpened after openDirectChat
 * has selected its recipient. Never inspect message bodies.
 */
(function () {
  "use strict";
  function onChatOpened({recipientId, currentUserId, language}={}) {
    if (!recipientId || !currentUserId || String(recipientId)===String(currentUserId)) return false;
    return window.XOXOSafetyReminderBeta?.show({
      conversationId: String(recipientId),
      accountId: String(currentUserId),
      locale: language || "en"
    }) || false;
  }
  window.XOXOSafetyChatBeta = Object.freeze({onChatOpened});
})();
