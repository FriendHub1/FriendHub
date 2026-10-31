/* XOXO Avenue — XOXO Streaks for direct messages */
(function () {
  "use strict";

  if (window.__xoxoStreaksLoaded) return;
  window.__xoxoStreaksLoaded = true;

  const I18N = {
    es: {
      label: "racha",
      day: "día",
      days: "días",
      together: "juntos",
      keep: "¡No rompan la racha! 💜",
      newStreak: "¡XOXO Streak! 💜",
      milestone: "¡{n} días hablando juntos!",
      record: "Récord: {n} días",
    },
    en: {
      label: "streak",
      day: "day",
      days: "days",
      together: "together",
      keep: "Keep the streak going! 💜",
      newStreak: "XOXO Streak! 💜",
      milestone: "{n} days talking together!",
      record: "Record: {n} days",
    },
    "pt-br": {
      label: "sequência",
      day: "dia",
      days: "dias",
      together: "juntos",
      keep: "Não deixem a sequência acabar! 💜",
      newStreak: "XOXO Streak! 💜",
      milestone: "{n} dias conversando juntos!",
      record: "Recorde: {n} dias",
    },
    de: {
      label: "Serie",
      day: "Tag",
      days: "Tage",
      together: "zusammen",
      keep: "Lasst die Serie nicht abreißen! 💜",
      newStreak: "XOXO Streak! 💜",
      milestone: "{n} Tage zusammen im Chat!",
      record: "Rekord: {n} Tage",
    },
    nb: {
      label: "rekke",
      day: "dag",
      days: "dager",
      together: "sammen",
      keep: "Hold rekken i gang! 💜",
      newStreak: "XOXO Streak! 💜",
      milestone: "{n} dager sammen i chatten!",
      record: "Rekord: {n} dager",
    },
    pl: {
      label: "seria",
      day: "dzień",
      days: "dni",
      together: "razem",
      keep: "Nie przerywajcie serii! 💜",
      newStreak: "XOXO Streak! 💜",
      milestone: "{n} dni rozmów razem!",
      record: "Rekord: {n} dni",
    },
    fr: {
      label: "série",
      day: "jour",
      days: "jours",
      together: "ensemble",
      keep: "Ne laissez pas la série s'arrêter ! 💜",
      newStreak: "XOXO Streak ! 💜",
      milestone: "{n} jours de discussion ensemble !",
      record: "Record : {n} jours",
    },
    cs: {
      label: "série",
      day: "den",
      days: "dny",
      together: "společně",
      keep: "Nenechte sérii přerušit! 💜",
      newStreak: "XOXO Streak! 💜",
      milestone: "{n} dní spolu v chatu!",
      record: "Rekord: {n} dní",
    },
    sv: {
      label: "serie",
      day: "dag",
      days: "dagar",
      together: "tillsammans",
      keep: "Håll serien vid liv! 💜",
      newStreak: "XOXO Streak! 💜",
      milestone: "{n} dagar tillsammans i chatten!",
      record: "Rekord: {n} dagar",
    },
    it: {
      label: "serie",
      day: "giorno",
      days: "giorni",
      together: "insieme",
      keep: "Non interrompete la serie! 💜",
      newStreak: "XOXO Streak! 💜",
      milestone: "{n} giorni di chat insieme!",
      record: "Record: {n} giorni",
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
        display:flex; align-items:center; gap:8px; width:max-content; max-width:100%;
        margin:7px auto 5px; padding:7px 13px; border-radius:999px;
        background:linear-gradient(135deg,rgba(255,255,255,.96),rgba(248,235,255,.96));
        border:1px solid rgba(155,80,210,.18); box-shadow:0 5px 18px rgba(104,45,130,.10);
        color:#64207e; font:600 13px/1.2 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      }
      #xoxoDmStreak .xoxo-streak-fire { font-size:18px; line-height:1; }
      #xoxoDmStreak .xoxo-streak-main { display:flex; flex-direction:column; gap:2px; }
      #xoxoDmStreak .xoxo-streak-count { font-size:14px; font-weight:800; }
      #xoxoDmStreak .xoxo-streak-sub { font-size:11px; font-weight:600; opacity:.78; }
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
    const record = Number(row.longest_streak) || n;
    const today = new Date().toISOString().slice(0, 10);
    const needsToday = row.last_active_date !== today;

    el.style.display = "flex";
    el.classList.toggle("xoxo-streak-milestone", !!milestone);
    el.innerHTML = `
      <span class="xoxo-streak-fire" aria-hidden="true">🔥</span>
      <span class="xoxo-streak-main">
        <span class="xoxo-streak-count">${n} ${unit} ${escapeHtml(t("together"))}</span>
        <span class="xoxo-streak-sub">${escapeHtml(milestone ? t("milestone", {n}) : (needsToday ? t("keep") : t("record", {n: record})))}</span>
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

  async function recordStreak() {
    const peer = currentPeer();
    const me = currentAccount();
    const c = client();
    if (!peer || !me || !c || typeof c.rpc !== "function") return null;
    try {
      const result = await c.rpc("xoxo_dm_streak_record_message", { p_recipient: peer });
      if (result?.error) return null;
      return Array.isArray(result.data) ? result.data[0] : result.data;
    } catch (_) {
      return null;
    }
  }

  let refreshTimer = null;
  let lastRenderedKey = "";

  async function refresh(record) {
    const row = record || await getStreak();
    if (!row) {
      render(null, false);
      return;
    }
    const key = `${row.current_streak}:${row.longest_streak}:${row.last_active_date || ""}`;
    const n = Number(row.current_streak) || 0;
    const milestoneKey = `xoxo-streak-milestone:${currentAccount()}:${currentPeer()}:${n}`;
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
      const row = await recordStreak();
      await refresh(row);
    }, 700);
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
    const el = header();
    if (el) el.style.display = "none";
    lastRenderedKey = "";
    watchMessages();
    setTimeout(() => refresh(), 350);
  }

  function installOpenHook() {
    const original = window.openDirectChat;
    if (typeof original !== "function" || original.__xoxoStreakWrapped) return false;
    async function wrapped() {
      const result = await original.apply(this, arguments);
      setTimeout(onChatChanged, 120);
      return result;
    }
    wrapped.__xoxoStreakWrapped = true;
    wrapped.__xoxoStreakOriginal = original;
    window.openDirectChat = wrapped;
    return true;
  }

  function boot() {
    ensureStyles();
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
