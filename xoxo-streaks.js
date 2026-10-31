/* XOXO Avenue — XOXO Streaks for direct messages */
(function () {
  "use strict";

  if (window.__xoxoStreaksLoaded) return;
  window.__xoxoStreaksLoaded = true;

  const I18N = {
    es: {
      label: "racha", day: "día", days: "días", together: "juntos",
      tagline: "¡Su conexión se hace más fuerte! 💜",
      bestStreak: "Mejor racha",
      keep: "¡Sigan hablando para mantener viva la chispa! ✨",
      newStreak: "¡XOXO Streak! 💜",
      milestone: "¡{n} días hablando juntos!",
    },
    en: {
      label: "streak", day: "day", days: "days", together: "together",
      tagline: "Your connection is getting stronger! 💜",
      bestStreak: "Best streak",
      keep: "Keep chatting to keep the spark alive! ✨",
      newStreak: "XOXO Streak! 💜",
      milestone: "{n} days talking together!",
    },
    "pt-br": {
      label: "sequência", day: "dia", days: "dias", together: "juntos",
      tagline: "A conexão de vocês está cada vez mais forte! 💜",
      bestStreak: "Melhor sequência",
      keep: "Continuem conversando para manter a chama acesa! ✨",
      newStreak: "XOXO Streak! 💜",
      milestone: "{n} dias conversando juntos!",
    },
    de: {
      label: "Serie", day: "Tag", days: "Tage", together: "zusammen",
      tagline: "Eure Verbindung wird immer stärker! 💜",
      bestStreak: "Beste Serie",
      keep: "Schreibt weiter, damit der Funke lebendig bleibt! ✨",
      newStreak: "XOXO Streak! 💜",
      milestone: "{n} Tage zusammen im Chat!",
    },
    nb: {
      label: "rekke", day: "dag", days: "dager", together: "sammen",
      tagline: "Båndet mellom dere blir sterkere! 💜",
      bestStreak: "Beste rekke",
      keep: "Fortsett å chatte for å holde gnisten levende! ✨",
      newStreak: "XOXO Streak! 💜",
      milestone: "{n} dager sammen i chatten!",
    },
    pl: {
      label: "seria", day: "dzień", days: "dni", together: "razem",
      tagline: "Wasza więź staje się coraz silniejsza! 💜",
      bestStreak: "Najlepsza seria",
      keep: "Rozmawiajcie dalej, aby podtrzymać iskrę! ✨",
      newStreak: "XOXO Streak! 💜",
      milestone: "{n} dni rozmów razem!",
    },
    fr: {
      label: "série", day: "jour", days: "jours", together: "ensemble",
      tagline: "Votre complicité devient de plus en plus forte ! 💜",
      bestStreak: "Meilleure série",
      keep: "Continuez à discuter pour garder la flamme ! ✨",
      newStreak: "XOXO Streak ! 💜",
      milestone: "{n} jours de discussion ensemble !",
    },
    cs: {
      label: "série", day: "den", days: "dny", together: "společně",
      tagline: "Vaše spojení je stále silnější! 💜",
      bestStreak: "Nejlepší série",
      keep: "Pište si dál a udržte jiskru! ✨",
      newStreak: "XOXO Streak! 💜",
      milestone: "{n} dní spolu v chatu!",
    },
    sv: {
      label: "serie", day: "dag", days: "dagar", together: "tillsammans",
      tagline: "Er kontakt blir allt starkare! 💜",
      bestStreak: "Bästa sviten",
      keep: "Fortsätt chatta och håll gnistan vid liv! ✨",
      newStreak: "XOXO Streak! 💜",
      milestone: "{n} dagar tillsammans i chatten!",
    },
    it: {
      label: "serie", day: "giorno", days: "giorni", together: "insieme",
      tagline: "Il vostro legame diventa sempre più forte! 💜",
      bestStreak: "Migliore serie",
      keep: "Continuate a chattare per tenere viva la scintilla! ✨",
      newStreak: "XOXO Streak! 💜",
      milestone: "{n} giorni di chat insieme!",
    },
  };

  function lang() {
    try {
      const raw = String(
        typeof getFriendHubLanguage === "function"
          ? getFriendHubLanguage()
          : localStorage.getItem("friendhub_language") || "en"
      ).toLowerCase().replace(/_/g, "-");
      if (raw === "pt" || raw.startsWith("pt-")) return "pt-br";
      if (raw === "no" || raw === "nb" || raw.startsWith("nb-")) return "nb";
      const base = raw.split("-")[0];
      return I18N[base] ? base : "en";
    } catch (_) {
      return "en";
    }
  }

  function t(key, vars) {
    let text = I18N[lang()][key] || I18N.en[key] || key;
    Object.keys(vars || {}).forEach((k) => {
      text = text.replace(new RegExp("\\{" + k + "\\}", "g"), String(vars[k]));
    });
    return text;
  }

  function currentPeer() {
    try {
      return typeof currentDmUserId !== "undefined" ? String(currentDmUserId || "") : "";
    } catch (_) {
      return "";
    }
  }

  function currentAccount() {
    try {
      return typeof currentUser !== "undefined" && currentUser?.id ? String(currentUser.id) : "";
    } catch (_) {
      return "";
    }
  }

  function client() {
    try {
      return typeof supabaseClient !== "undefined" ? supabaseClient : window.supabaseClient;
    } catch (_) {
      return window.supabaseClient || null;
    }
  }

  function ensureStyles() {
    if (document.getElementById("xoxo-streaks-style")) return;
    const style = document.createElement("style");
    style.id = "xoxo-streaks-style";
    style.textContent = `
      #dmChat .dm-chat-header #xoxoDmStreak {
        display:inline-flex; align-items:center; gap:7px; flex:0 1 auto;
        width:auto; max-width:min(46%,280px); min-width:0; margin:0 8px;
        padding:7px 11px; border-radius:999px; vertical-align:middle;
        background:linear-gradient(135deg,rgba(255,255,255,.98),rgba(248,235,255,.98));
        border:1px solid rgba(155,80,210,.28); box-shadow:0 3px 12px rgba(104,45,130,.13);
        color:#64207e; font:700 11px/1.2 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        overflow:hidden;
      }
      #dmChat .dm-chat-header #xoxoDmStreak .xoxo-streak-fire { font-size:17px; flex:0 0 auto; }
      #dmChat .dm-chat-header #xoxoDmStreak .xoxo-streak-main { display:flex; flex-direction:column; gap:3px; min-width:0; }
      #dmChat .dm-chat-header #xoxoDmStreak .xoxo-streak-count { font-size:11px; font-weight:850; white-space:nowrap; }
      #dmChat .dm-chat-header #xoxoDmStreak .xoxo-streak-tagline { font-size:9px; font-weight:600; opacity:.78; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      #dmChat .dm-chat-header #xoxoDmStreak .xoxo-streak-best { display:flex; align-items:center; gap:4px; font-size:9px; white-space:nowrap; }
      #dmChat .dm-chat-header #xoxoDmStreak .xoxo-streak-best-label { font-weight:700; }
      #dmChat .dm-chat-header #xoxoDmStreak .xoxo-streak-best-value { font-weight:850; }
      #dmChat .dm-chat-header #xoxoDmStreak .xoxo-streak-divider,
      #dmChat .dm-chat-header #xoxoDmStreak .xoxo-streak-keep { display:none; }
      #xoxoDmStreak.xoxo-streak-milestone { animation:xoxoStreakPop .65s ease both; }
      @keyframes xoxoStreakPop { 0%{transform:scale(.92);opacity:0} 65%{transform:scale(1.04);opacity:1} 100%{transform:scale(1)} }
      @media (max-width:600px){
        #dmChat .dm-chat-header #xoxoDmStreak { max-width:42%; margin:0 4px; padding:6px 8px; gap:5px; }
        #dmChat .dm-chat-header #xoxoDmStreak .xoxo-streak-tagline { display:none; }
      }
    `;
    document.head.appendChild(style);
  }

  function header() {
    const chat = document.getElementById("dmChat");
    if (!chat) return null;
    const h = chat.querySelector(".dm-chat-header") || chat.querySelector("header");
    if (!h) return null;
    let el = document.getElementById("xoxoDmStreak");
    if (!el) {
      el = document.createElement("div");
      el.id = "xoxoDmStreak";
      el.setAttribute("aria-live", "polite");
      el.setAttribute("role", "status");
    }
    // Keep the streak inside the conversation toolbar, beside its controls.
    if (el.parentElement !== h) h.appendChild(el);
    return el;
  }

  function render(row, milestone) {
    const el = header();
    if (!el) return;
    if (!row || !row.current_streak) {
      el.style.display = "none";
      el.classList.remove("xoxo-streak-milestone");
      return;
    }

    const n = Number(row.current_streak) || 0;
    const unit = n === 1 ? t("day") : t("days");
    const best = Number(row.longest_streak) || n;
    const bestUnit = best === 1 ? t("day") : t("days");

    el.style.display = "inline-flex";
    el.classList.toggle("xoxo-streak-milestone", !!milestone);
    el.title = t("tagline") + " " + t("keep");
    el.innerHTML = `
      <span class="xoxo-streak-fire" aria-hidden="true">🔥</span>
      <span class="xoxo-streak-main">
        <span class="xoxo-streak-count">${n} ${unit} ${escapeHtml(t("together"))}</span>
        <span class="xoxo-streak-tagline">${escapeHtml(t("tagline"))}</span>
        <span class="xoxo-streak-best">
          <span class="xoxo-streak-best-label">🏆 ${escapeHtml(t("bestStreak"))}</span>
          <span class="xoxo-streak-best-value">${best} ${escapeHtml(bestUnit)}</span>
        </span>
      </span>`;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  async function getStreak() {
    const peer = currentPeer();
    const me = currentAccount();
    const c = client();
    if (!peer || !me || !c || typeof c.rpc !== "function") return null;
    try {
      const result = await c.rpc("xoxo_dm_streak_get", { p_peer: peer });
      if (result?.error) return null;
      const data = Array.isArray(result.data) ? result.data[0] : result.data;
      return data || null;
    } catch (_) {
      return null;
    }
  }

  let refreshTimer = null;
  let lastRenderedKey = "";
  let lastObservedPeer = "";

  let lastStreakRow = null;
  let lastLanguage = "";

  async function refresh(record) {
    const row = record || await getStreak();
    lastStreakRow = row || null;
    lastLanguage = lang();
    if (!row) {
      render(null, false);
      return;
    }
    const key = `${row.current_streak}:${row.longest_streak}:${row.last_active_date || ""}`;
    const n = Number(row.current_streak) || 0;
    const milestoneKey = `xoxo-streak-milestone:${currentAccount()}:${currentPeer()}:${n}:${row.last_active_date || ""}`;
    let alreadyCelebrated = false;
    try { alreadyCelebrated = localStorage.getItem(milestoneKey) === "1"; } catch (_) {}
    const milestone = n > 0 &&
      [7,30,100,180,365,500,1000].includes(n) &&
      key !== lastRenderedKey && !alreadyCelebrated;
    if (milestone) {
      try { localStorage.setItem(milestoneKey, "1"); } catch (_) {}
    }
    lastRenderedKey = key;
    render(row, milestone);
  }

  function scheduleRecord() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(async () => {
      // The database trigger records each persisted ordinary DM exactly once
      // for that sender/day. The browser only refreshes the shared result.
      await refresh();
    }, 500);
  }

  function watchMessages() {
    const box = document.getElementById("dmMessages");
    if (!box || box.__xoxoStreakObserver) return;
    const observer = new MutationObserver((mutations) => {
      if (!mutations.some((m) => m.addedNodes && m.addedNodes.length)) return;
      scheduleRecord();
    });
    observer.observe(box, { childList: true, subtree: true });
    box.__xoxoStreakObserver = observer;
  }

  function onChatChanged() {
    ensureStyles();
    const peer = currentPeer();
    if (peer) lastObservedPeer = peer;
    const el = header();
    if (el) el.style.display = "none";
    lastRenderedKey = "";
    watchMessages();
    setTimeout(() => refresh(), 350);
  }

  function watchChatLifecycle() {
    const chat = document.getElementById("dmChat");
    if (!chat || chat.__xoxoStreakLifecycleObserver) return;
    const observer = new MutationObserver(() => {
      const peer = currentPeer();
      const visible = chat.style.display !== "none" && !!peer;
      if (!visible) {
        lastObservedPeer = "";
        return;
      }
      if (peer !== lastObservedPeer) onChatChanged();
    });
    observer.observe(chat, {
      attributes: true,
      attributeFilter: ["style"],
      childList: true,
      subtree: true,
      characterData: true
    });
    chat.__xoxoStreakLifecycleObserver = observer;
  }

  function installOpenHook() {
    const original = window.openDirectChat;
    if (typeof original !== "function" || original.__xoxoStreakWrapped) return false;
    async function wrapped() {
      const result = await original.apply(this, arguments);
      // A conversation may be reopened with the same peer after navigating
      // away (for example, the language selector returns the app to Home).
      // Refresh unconditionally after the real app finishes opening the chat.
      setTimeout(() => {
        lastObservedPeer = currentPeer();
        onChatChanged();
      }, 180);
      return result;
    }
    wrapped.__xoxoStreakWrapped = true;
    wrapped.__xoxoStreakOriginal = original;
    window.openDirectChat = wrapped;
    return true;
  }

  function watchLanguageChanges() {
    const repaint = () => {
      const next = lang();
      if (next === lastLanguage) return;
      lastLanguage = next;
      if (lastStreakRow) render(lastStreakRow, false);
    };
    // The storage event covers changes made in another tab; the wrapper
    // covers same-tab language selectors, where the storage event does not fire.
    window.addEventListener("storage", (event) => {
      if (event.key === "friendhub_language") repaint();
    });
    window.addEventListener("xoxo:language-changed", repaint);
    try {
      const originalSetItem = Storage.prototype.setItem;
      if (!originalSetItem.__xoxoStreakLanguageHook) {
        const wrappedSetItem = function(key, value) {
          const result = originalSetItem.apply(this, arguments);
          if (key === "friendhub_language") setTimeout(repaint, 0);
          return result;
        };
        wrappedSetItem.__xoxoStreakLanguageHook = true;
        Storage.prototype.setItem = wrappedSetItem;
      }
    } catch (_) {}
    if (typeof MutationObserver === "function" && document.documentElement) {
      const observer = new MutationObserver(repaint);
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    }
    // Some language selectors update an in-memory locale without touching
    // localStorage or <html lang>; this lightweight check catches that too.
    setInterval(repaint, 700);
  }

  function boot() {
    ensureStyles();
    watchLanguageChanges();
    installOpenHook();
    onChatChanged();
    window.addEventListener("xoxo:dm-opened", onChatChanged);

    // Re-attach if the app defines/replaces its global chat opener later.
    let hookAttempts = 0;
    const hookTimer = setInterval(() => {
      if (installOpenHook() || ++hookAttempts >= 80) clearInterval(hookTimer);
    }, 250);

    // The messages view is mounted lazily after navigation from Home.
    // Observe the document, not only #dmChat at initial page load.
    const scanChat = () => {
      ensureStyles();
      watchChatLifecycle();
      watchMessages();
      installOpenHook();
      const chat = document.getElementById("dmChat");
      const peer = currentPeer();
      const visible = !!chat && chat.style.display !== "none" && !!peer;
      if (visible && peer !== lastObservedPeer) {
        lastObservedPeer = peer;
        onChatChanged();
      } else if (!visible && lastObservedPeer) {
        lastObservedPeer = "";
      }
    };

    if (document.body && typeof MutationObserver === "function") {
      const pageObserver = new MutationObserver(scanChat);
      pageObserver.observe(document.body, { childList:true, subtree:true, attributes:true, attributeFilter:["style","class"] });
    }
    // Also catches app navigation or a late-created chat panel when no
    // relevant DOM mutation is emitted by the page's router.
    setInterval(scanChat, 500);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, {once:true});
  else boot();
})();
