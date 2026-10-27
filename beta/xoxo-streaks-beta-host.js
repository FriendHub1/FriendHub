/* XOXO Streaks BETA host integration.
 * Only loaded in the isolated workers.dev preview with ?xoxo_streaks_beta=1.
 * Never included in the production page or enabled by default.
 */
(function (root) {
  "use strict";
  const FLAG = "xoxo_streaks_beta";
  let bridge = null;
  let mount = null;
  let activeKey = "";
  let lastActivity = "";
  let timer = null;
  let observer = null;

  function enabled() {
    return /(?:^|\.)workers\.dev$/i.test(location.hostname) &&
      new URLSearchParams(location.search).get(FLAG) === "1";
  }
  function account() {
    return typeof currentUser !== "undefined" && currentUser && currentUser.id
      ? String(currentUser.id) : "";
  }
  function peer() {
    return typeof currentDmUserId !== "undefined" && currentDmUserId
      ? String(currentDmUserId) : "";
  }
  function client() {
    return typeof supabaseClient !== "undefined" ? supabaseClient : null;
  }
  function locale() {
    return typeof getFriendHubLanguage === "function" ? getFriendHubLanguage() : "en";
  }
  function chat() {
    const el = document.getElementById("dmChat");
    if (!el || !el.isConnected || el.style.display === "none") return null;
    if (el.getAttribute("aria-hidden") === "true") return null;
    return el;
  }
  function visible(el) {
    if (!el) return false;
    const style = getComputedStyle(el);
    return style.display !== "none" && style.visibility !== "hidden" &&
      el.getClientRects().length > 0;
  }
  // Fail closed until the canonical chat flow provides its authoritative decision.
  // This is intentionally not inferred from CSS, DOM visibility, or a guessed DB table.
  function conversationAllowed(me, other) {
    // Permission checks are untrusted at this boundary: exceptions must fail closed
    // so a stale streak card cannot remain visible if the canonical check fails.
    try {
      return typeof root.xoxoIsConversationVisible === "function" &&
        root.xoxoIsConversationVisible(me, other) === true;
    } catch (_) {
      return false;
    }
  }
  function activitySignature() {
    const rows = Array.isArray(root.__xoxoCurrentDmMessages)
      ? root.__xoxoCurrentDmMessages : [];
    return rows.map(m => [
      m && m.id || "",
      m && m.created_at || "",
      m && m.sender_id || "",
      m && m.whisper_id || "",
      m && m.media_view_mode || "normal"
    ].join("|")).join(";");
  }
  function clear() {
    if (bridge) bridge.destroy();
    bridge = null;
    if (mount && mount.isConnected) mount.remove();
    mount = null;
    activeKey = "";
    lastActivity = "";
  }
  function sync() {
    if (!enabled()) { clear(); return; }
    const panel = chat();
    const me = account();
    const other = peer();
    const db = client();
    if (!panel || !visible(panel) || !me || !other || me === other || !db ||
        root.xoxoIsAdmin === true || !conversationAllowed(me, other)) {
      clear();
      return;
    }
    const language = String(locale() || "en");
    const nextKey = [me, other, language].join(":");
    if (!mount || !mount.isConnected || !panel.contains(mount) || activeKey !== nextKey) {
      clear();
      mount = document.createElement("div");
      mount.id = "xoxoStreaksBetaMount";
      mount.setAttribute("data-xoxo-streaks-beta-mount", "");
      mount.style.cssText = "display:block;width:100%;box-sizing:border-box;padding:0 12px";
      panel.prepend(mount);
      activeKey = nextKey;
      bridge = root.XOXOStreaksChatBridgeBeta && root.XOXOStreaksChatBridgeBeta.create({
        enabled: true,
        getClient: client,
        getAccountId: account,
        getOtherUserId: peer,
        getLocale: locale,
        getMount: () => mount,
        onError: () => {}
      });
      lastActivity = activitySignature();
      if (bridge) void bridge.refresh();
      return;
    }
    const activity = activitySignature();
    if (activity !== lastActivity) {
      lastActivity = activity;
      if (bridge) void bridge.refresh();
    }
  }
  function start() {
    if (!enabled()) return;
    sync();
    observer = new MutationObserver(() => sync());
    observer.observe(document.documentElement, {subtree:true, childList:true, attributes:true,
      attributeFilter:["style","class","aria-hidden"]});
    timer = setInterval(sync, 1800);
    root.addEventListener("pagehide", stop, {once:true});
  }
  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
    if (observer) observer.disconnect();
    observer = null;
    clear();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, {once:true});
  } else {
    start();
  }
})(window);
