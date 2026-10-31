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
      #xoxoDmStreak {
        display:flex; align-items:flex-start; gap:9px; width:max-content; max-width:calc(100% - 20px);
        margin:8px auto 6px; padding:10px 14px; border-radius:15px;
        background:linear-gradient(135deg,rgba(255,255,255,.98),rgba(248,235,255,.98));
        border:1px solid rgba(155,80,210,.22); box-shadow:0 5px 18px rgba(104,45,130,.10);
        color:#64207e; font:600 13px/1.3 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      }
      #xoxoDmStreak .xoxo-streak-fire { font-size:21px; line-height:1.1; padding-top:1px; }
      #xoxoDmStreak .xoxo-streak-main { display:flex; flex-direction:column; gap:4px; min-width:0; }
      #xoxoDmStreak .xoxo-streak-count { font-size:14px; font-weight:800; }
      #xoxoDmStreak .xoxo-streak-tagline { font-size:11px; font-weight:600; opacity:.82; }
      #xoxoDmStreak .xoxo-streak-divider { height:1px; background:rgba(155,80,210,.18); margin:3px 0; }
      #xoxoDmStreak .xoxo-streak-best { display:flex; align-items:center; justify-content:space-between; gap:12px; font-size:11px; }
      #xoxoDmStreak .xoxo-streak-best-label { font-weight:700; }
      #xoxoDmStreak .xoxo-streak-best-value { font-weight:800; white-space:nowrap; }
      #xoxoDmStreak .xoxo-streak-keep { font-size:10px; font-weight:600; opacity:.78; }
      #xoxoDmStreak.xoxo-streak-milestone { animation:xoxoStreakPop .65s ease both; }
      @keyframes xoxoStreakPop { 0%{transform:scale(.86);opacity:0} 65%{transform:scale(1.05);opacity:1} 100%{transform:scale(1)} }
      @media (max-width:600px){ #xoxoDmStreak{font-size:12px;padding:6px 11px} }
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
      h.insertAdjacentElement("afterend", el);
    }
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

    el.style.display = "flex";
    el.classList.toggle("xoxo-streak-milestone", !!milestone);
    el.innerHTML = `
      <span class="xoxo-streak-fire" aria-hidden="true">🔥</span>
      <span class="xoxo-streak-main">
        <span class="xoxo-streak-count">${n} ${unit} ${escapeHtml(t("together"))}</span>
        <span class="xoxo-streak-tagline">${escapeHtml(t("tagline"))}</span>
        <span class="xoxo-streak-divider" aria-hidden="true"></span>
        <span class="xoxo-streak-best">
          <span class="xoxo-streak-best-label">🏆 ${escapeHtml(t("bestStreak"))}</span>
          <span class="xoxo-streak-best-value">${best} ${escapeHtml(bestUnit)}</span>
        </span>
        <span class="xoxo-streak-keep">${escapeHtml(t("keep"))}</span>
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

  async function refresh(record) {
    const row = record || await getStreak();
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
      if (currentPeer() !== lastObservedPeer) setTimeout(onChatChanged, 120);
      return result;
    }
    wrapped.__xoxoStreakWrapped = true;
    wrapped.__xoxoStreakOriginal = original;
    window.openDirectChat = wrapped;
    return true;
  }

  function boot() {
    ensureStyles();
    watchChatLifecycle();
    installOpenHook();
    onChatChanged();
    let tries = 0;
    const timer = setInterval(() => {
      if (installOpenHook() || ++tries > 30) clearInterval(timer);
    }, 500);
    window.addEventListener("xoxo:dm-opened", onChatChanged);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, {once:true});
  else boot();
})();
