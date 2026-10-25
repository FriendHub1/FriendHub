/* XOXO Avenue — Stay Safe, Sweetheart! BETA index.html integration hooks.
 * Safe to load in a BETA preview only. All new report writes are OFF.
 *
 * Set REPORT_WRITES_ENABLED to true ONLY after the matching Supabase RPCs
 * are deployed and security-tested; never infer readiness from the browser.
 * Existing single-message reporting and PIN moderation remain independent.
 */
(function (root) {
  "use strict";
  const REPORT_WRITES_ENABLED = false;
  const ADMIN_QUEUE_ENABLED = false;
  let activeFlow = null;
  let activeKey = "";

  function onOpenDirectChat({ client, accountId, otherUserId, locale, getMessages } = {}) {
    const api = root?.XOXOSafetyFlowBeta;
    if (typeof api?.create !== "function") return false;
    if (typeof accountId !== "string" || typeof otherUserId !== "string" ||
        !accountId || !otherUserId || accountId === otherUserId ||
        typeof getMessages !== "function") return false;

    // The same pair must map to the same localStorage reminder key on both devices.
    const conversationId = [accountId.toLowerCase(), otherUserId.toLowerCase()].sort().join(":");
    try {
      activeFlow = api.create({
        client, accountId, otherUserId, conversationId,
        locale: locale || "en",
        getMessages,
        enabled: REPORT_WRITES_ENABLED
      });
      activeKey = conversationId;
      attachReportButton();
      return activeFlow.showReminder();
    } catch {
      activeFlow = null;
      activeKey = "";
      return false;
    }
  }

  function attachReportButton() {
    if (typeof root?.document?.querySelector !== "function") return;
    const old = root.document.querySelector("#xoxoSafetyBetaReportButton");
    if (!REPORT_WRITES_ENABLED || !activeFlow) {
      if (old) old.remove();
      return;
    }
    if (old) return;
    const beside = root.document.querySelector("#dmChat .dm-chat-delete-button");
    if (!beside || !beside.parentNode) return;
    const b = root.document.createElement("button");
    b.type = "button";
    b.id = "xoxoSafetyBetaReportButton";
    b.className = "dm-chat-delete-button";
    b.textContent = "🚩";
    b.setAttribute("aria-label", "Report conversation");
    b.setAttribute("title", "Report conversation");
    b.addEventListener("click", () => activeFlow?.openReport());
    beside.parentNode.insertBefore(b, beside);
  }

  function onCloseDirectChat() {
    activeFlow = null;
    activeKey = "";
    const old = root?.document?.getElementById?.("xoxoSafetyBetaReportButton");
    if (old) old.remove();
  }

  async function attachAdmin({ client, container, locale, onOpenConversation, onUnlock, onError } = {}) {
    if (!ADMIN_QUEUE_ENABLED) return false;
    if (!container || typeof onOpenConversation !== "function") return false;
    try {
      const api = root?.XOXOAdminConversationReportsBeta;
      if (typeof api?.create !== "function") return false;
      const bridge = api.create({ client, locale, onOpenConversation, onUnlock, onError });
      return await bridge.attach(container);
    } catch {
      return false;
    }
  }

  // For diagnostics only: never surface secrets, user IDs or conversation text.
  root.XOXOSafetyBetaHost = Object.freeze({
    onOpenDirectChat, onCloseDirectChat, attachAdmin,
    isReportWritesEnabled: () => REPORT_WRITES_ENABLED,
    isAdminQueueEnabled: () => ADMIN_QUEUE_ENABLED
  });
})(typeof window !== "undefined" ? window : null);
