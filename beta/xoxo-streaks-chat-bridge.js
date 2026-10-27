/* XOXO Avenue — XOXO Streaks BETA host bridge.
 * This file is intentionally opt-in and does not patch index.html or production.
 */
(function (root) {
  "use strict";
  function create(options) {
    if (!options || options.enabled !== true ||
        typeof options.getClient !== "function" ||
        typeof options.getAccountId !== "function" ||
        typeof options.getOtherUserId !== "function" ||
        typeof options.getLocale !== "function" ||
        typeof options.getMount !== "function") return null;

    let instance = null;
    let key = "";
    let closed = false;

    function cleanup() {
      if (instance) instance.destroy();
      instance = null;
      key = "";
      const mount = options.getMount();
      if (mount && typeof mount.replaceChildren === "function") mount.replaceChildren();
    }

    function currentContext() {
      const account = options.getAccountId();
      const other = options.getOtherUserId();
      if (!account || !other || String(account) === String(other)) return null;
      return { account: String(account), other: String(other) };
    }

    async function refresh() {
      if (closed) return false;
      const ctx = currentContext();
      const mount = options.getMount();
      if (!ctx || !mount || typeof mount.replaceChildren !== "function") {
        cleanup();
        return false;
      }
      const nextKey = ctx.account + ":" + ctx.other;
      if (!instance || key !== nextKey) {
        cleanup();
        if (closed) return false;
        instance = root.XOXOStreaksBeta && root.XOXOStreaksBeta.create({
          client: options.getClient(),
          accountId: ctx.account,
          otherUserId: ctx.other,
          locale: options.getLocale(),
          mount,
          onError: options.onError
        });
        key = instance ? nextKey : "";
      }
      // Re-check identity after async setup to avoid painting stale account/chat data.
      const tokenKey = key;
      const ok = instance ? await instance.refresh() : false;
      const latest = currentContext();
      if (closed || !latest || tokenKey !== latest.account + ":" + latest.other || key !== tokenKey) {
        cleanup();
        return false;
      }
      return ok;
    }

    return Object.freeze({
      refresh,
      clear: cleanup,
      destroy() {
        closed = true;
        cleanup();
      }
    });
  }
  root.XOXOStreaksChatBridgeBeta = Object.freeze({ create });
})(typeof window !== "undefined" ? window : globalThis);
