/* BETA-only integration shim. Include AFTER stay-safe-sweetheart.js and after main app scripts.
   The main app's openDirectChat is a global function; this shim wraps it without changing production.
   This file is not loaded until explicitly added to a BETA build. */
(function () {
  "use strict";
  function attach() {
    const original = window.openDirectChat;
    if (typeof original !== "function" || original.__xoxoSafetyWrapped) return false;
    const wrapped = function (userId, username, profilePhoto) {
      const result = original.apply(this, arguments);
      // The original function checks authentication and self-chat; repeat checks here.
      const me = typeof currentUser !== "undefined" ? currentUser : null;
      if (me?.id && userId && String(me.id) !== String(userId)) {
        const locale = typeof getFriendHubLanguage === "function" ? getFriendHubLanguage() : "en";
        window.XOXOSafetyReminderBeta?.show({
          conversationId: [String(me.id), String(userId)].sort().join(":"),
          accountId: String(me.id),
          locale
        });
      }
      return result;
    };
    wrapped.__xoxoSafetyWrapped = true;
    window.openDirectChat = wrapped;
    return true;
  }
  window.XOXOSafetyReminderBetaAttach = attach;
  // Do not automatically wrap until the BETA page explicitly opts in.
})();
