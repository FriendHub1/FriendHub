/* XOXO Avenue — Online Now / Online Glow */
(function () {
  "use strict";
  if (window.__xoxoOnlineGlowLoaded) return;
  window.__xoxoOnlineGlowLoaded = true;

  const ONLINE_WINDOW_MS = 3 * 60 * 1000;
  const HEARTBEAT_MS = 60 * 1000;
  const REFRESH_MS = 45 * 1000;
  const COPY = {
    es: { title: "Online Now ✨", subtitle: "Personas conectadas ahora", empty: "Por ahora no hay nadie más conectado. 💜", online: "En línea" },
    en: { title: "Online Now ✨", subtitle: "People here right now", empty: "No one else is online right now. 💜", online: "Online" },
    "pt-br": { title: "Online Agora ✨", subtitle: "Pessoas conectadas agora", empty: "Ninguém mais está online agora. 💜", online: "Online" },
    fr: { title: "En ligne ✨", subtitle: "Personnes connectées maintenant", empty: "Personne d’autre n’est en ligne pour le moment. 💜", online: "En ligne" },
    pl: { title: "Teraz online ✨", subtitle: "Osoby dostępne w tej chwili", empty: "Nikt inny nie jest teraz online. 💜", online: "Online" },
    de: { title: "Jetzt online ✨", subtitle: "Gerade aktive Personen", empty: "Zurzeit ist niemand sonst online. 💜", online: "Online" },
    nb: { title: "Pålogget nå ✨", subtitle: "Personer som er pålogget nå", empty: "Ingen andre er pålogget akkurat nå. 💜", online: "Pålogget" },
    cs: { title: "Právě online ✨", subtitle: "Lidé právě připojení", empty: "Nikdo další teď není online. 💜", online: "Online" },
    sv: { title: "Online nu ✨", subtitle: "Personer som är här just nu", empty: "Ingen annan är online just nu. 💜", online: "Online" },
    it: { title: "Online ora ✨", subtitle: "Persone collegate in questo momento", empty: "Al momento non c’è nessun altro online. 💜", online: "Online" }
  };

  function language() {
    try {
      const raw = String((typeof getFriendHubLanguage === "function" && getFriendHubLanguage()) ||
        localStorage.getItem("friendhub_language") || document.documentElement.lang || "en").toLowerCase().replace(/_/g, "-");
      if (raw === "pt" || raw.startsWith("pt-")) return "pt-br";
      if (raw === "no" || raw === "nb" || raw.startsWith("nb-")) return "nb";
      const base = raw.split("-")[0];
      return COPY[base] ? base : "en";
    } catch (_) { return "en"; }
  }

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, ch => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[ch]);
  }

  function client() {
    return typeof supabaseClient !== "undefined" && supabaseClient ? supabaseClient : null;
  }

  async function heartbeat() {
    const db = client();
    if (!db || !navigator.onLine || document.visibilityState === "prerender") return;
    try {
      const result = await db.auth.getSession();
      const session = result && result.data && result.data.session;
      if (!session || !session.access_token) return;
      await fetch("/api/activity-presence-heartbeat", {
        method: "POST",
        headers: { Authorization: "Bearer " + session.access_token, "Content-Type": "application/json" },
        credentials: "same-origin",
        cache: "no-store"
      });
    } catch (error) {
      console.debug("XOXO Online Glow heartbeat unavailable:", error);
    }
  }

  function ensureStyles() {
    if (document.getElementById("xoxo-online-glow-styles")) return;
    const style = document.createElement("style");
    style.id = "xoxo-online-glow-styles";
    style.textContent = [
      "#xoxoOnlineNowSection{margin:18px 0 22px;padding:16px;border:1px solid rgba(190,112,255,.32);border-radius:20px;background:linear-gradient(135deg,rgba(55,25,78,.96),rgba(30,16,47,.96));box-shadow:0 8px 28px rgba(112,45,160,.12);}",
      "#xoxoOnlineNowSection .xoxo-online-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:4px;}",
      "#xoxoOnlineNowSection .xoxo-online-title{margin:0;color:#fff;font-size:18px;font-weight:800;letter-spacing:.1px;}",
      "#xoxoOnlineNowSection .xoxo-online-live{font-size:10px;font-weight:800;letter-spacing:1px;color:#8af5b4;border:1px solid rgba(100,240,160,.35);border-radius:999px;padding:5px 9px;}",
      "#xoxoOnlineNowSection .xoxo-online-subtitle{color:#d9c2e9;font-size:12px;margin:3px 0 14px;}",
      "#xoxoOnlineNowSection .xoxo-online-list{display:flex;gap:17px;overflow-x:auto;padding:3px 2px 8px;scrollbar-width:thin;}",
      "#xoxoOnlineNowSection .xoxo-online-person{flex:0 0 76px;min-width:76px;border:0;background:transparent;color:#fff;padding:0;text-align:center;cursor:pointer;font:inherit;}",
      "#xoxoOnlineNowSection .xoxo-online-avatar{position:relative;display:grid;place-items:center;width:66px;height:66px;margin:0 auto 7px;border-radius:50%;}",
      "#xoxoOnlineNowSection .xoxo-online-avatar:before{content:'';position:absolute;inset:-4px;border-radius:50%;border:2px solid #bd78ff;box-shadow:0 0 8px #bd78ff,0 0 17px rgba(189,120,255,.72);animation:xoxoOnlinePulse 2.1s ease-in-out infinite;pointer-events:none;}",
      "#xoxoOnlineNowSection .xoxo-online-avatar img{width:66px;height:66px;border-radius:50%;object-fit:cover;display:block;}",
      "#xoxoOnlineNowSection .xoxo-online-dot{position:absolute;right:0;bottom:1px;width:15px;height:15px;border:3px solid #29163b;border-radius:50%;background:#42e58b;box-shadow:0 0 9px #42e58b;}",
      "#xoxoOnlineNowSection .xoxo-online-name{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;font-weight:700;color:#fff;}",
      "#xoxoOnlineNowSection .xoxo-online-status{display:block;margin-top:2px;color:#8af5b4;font-size:10px;}",
      "#xoxoOnlineNowSection .xoxo-online-empty{padding:12px 4px;color:#e0cce9;font-size:13px;text-align:center;}",
      ".friend-suggestion-avatar{position:relative;display:inline-block;}",
      ".friend-suggestion-avatar .xoxo-online-card-dot{position:absolute;right:0;bottom:1px;width:13px;height:13px;border:3px solid #29163b;border-radius:50%;background:#42e58b;box-shadow:0 0 8px #42e58b;}",
      ".friend-suggestion-card .xoxo-online-card-status{display:block;margin-top:3px;color:#42d985;font-size:11px;font-weight:700;}",
      "@keyframes xoxoOnlinePulse{0%,100%{opacity:.72;transform:scale(.98)}50%{opacity:1;transform:scale(1.045)}}",
      "@media(prefers-reduced-motion:reduce){#xoxoOnlineNowSection .xoxo-online-avatar:before{animation:none}}"
    ].join("");
    document.head.appendChild(style);
  }

  function findAnchor() {
    const suggestions = document.getElementById("friendSuggestionsSection");
    if (suggestions && suggestions.parentElement) return suggestions;
    const discover = document.querySelector("#discover, #discoverSection, [data-page='discover'], .discover-page");
    return discover || null;
  }

  function ensureSection() {
    let section = document.getElementById("xoxoOnlineNowSection");
    const anchor = findAnchor();
    if (!anchor || !anchor.parentElement) return null;
    if (!section) {
      section = document.createElement("section");
      section.id = "xoxoOnlineNowSection";
      section.setAttribute("aria-label", "Online Now");
      anchor.parentElement.insertBefore(section, anchor);
    } else if (section.parentElement !== anchor.parentElement) {
      anchor.parentElement.insertBefore(section, anchor);
    }
    return section;
  }

  function decorateSuggestionCards(onlineIds) {
    const es = language() === "es";
    document.querySelectorAll(".friend-suggestion-card[data-suggestion-user]").forEach(card => {
      const id = String(card.getAttribute("data-suggestion-user") || "");
      const avatar = card.querySelector(".friend-suggestion-avatar");
      const detail = card.querySelector(".friend-suggestion-reason");
      const isOnline = onlineIds.has(id);
      let dot = avatar && avatar.querySelector(".xoxo-online-card-dot");
      let label = card.querySelector(".xoxo-online-card-status");
      if (isOnline && avatar && !dot) {
        dot = document.createElement("span");
        dot.className = "xoxo-online-card-dot";
        dot.setAttribute("aria-label", es ? "En línea" : "Online");
        avatar.appendChild(dot);
      } else if (!isOnline && dot) dot.remove();
      if (isOnline && detail && !label) {
        label = document.createElement("span");
        label.className = "xoxo-online-card-status";
        label.textContent = es ? "● En línea" : "● Online";
        detail.insertAdjacentElement("afterend", label);
      } else if (!isOnline && label) label.remove();
    });
  }

  async function loadOnlinePeople() {
    const db = client();
    if (!db || typeof currentUser === "undefined" || !currentUser || !currentUser.id) return;
    const section = ensureSection();
    if (!section) return;
    const t = COPY[language()];
    const cutoff = new Date(Date.now() - ONLINE_WINDOW_MS).toISOString();
    try {
      const presenceResult = await db.from("user_presence")
        .select("user_id,last_active_at")
        .gte("last_active_at", cutoff)
        .order("last_active_at", { ascending: false })
        .limit(40);
      if (presenceResult.error) throw presenceResult.error;

      const myId = String(currentUser.id);
      let ids = [...new Set((presenceResult.data || [])
        .map(row => String(row.user_id || ""))
        .filter(id => id && id !== myId))];

      decorateSuggestionCards(new Set(ids));

      if (!ids.length) {
        section.innerHTML = '<div class="xoxo-online-head"><h3 class="xoxo-online-title">' + t.title + '</h3><span class="xoxo-online-live">LIVE</span></div><p class="xoxo-online-subtitle">' + t.subtitle + '</p><div class="xoxo-online-empty">' + t.empty + '</div>';
        return;
      }

      const [profilesResult, blocksResult] = await Promise.all([
        db.from("friendhub_public_profiles").select("user_id,username,profile_photo").in("user_id", ids),
        db.from("user_blocks").select("blocker_id,blocked_id").or("blocker_id.eq." + myId + ",blocked_id.eq." + myId)
      ]);
      if (profilesResult.error) throw profilesResult.error;
      const blocked = new Set();
      if (!blocksResult.error) {
        for (const row of blocksResult.data || []) {
          if (String(row.blocker_id) === myId) blocked.add(String(row.blocked_id));
          if (String(row.blocked_id) === myId) blocked.add(String(row.blocker_id));
        }
      }

      const profiles = (profilesResult.data || [])
        .filter(profile => !blocked.has(String(profile.user_id)) &&
          String(profile.username || "").replace(/^@+/, "").toLowerCase() !== "xoxoadmin")
        .sort((a, b) => ids.indexOf(String(a.user_id)) - ids.indexOf(String(b.user_id)))
        .slice(0, 12);

      if (!profiles.length) {
        section.innerHTML = '<div class="xoxo-online-head"><h3 class="xoxo-online-title">' + t.title + '</h3><span class="xoxo-online-live">LIVE</span></div><p class="xoxo-online-subtitle">' + t.subtitle + '</p><div class="xoxo-online-empty">' + t.empty + '</div>';
        return;
      }

      const cards = profiles.map(profile => {
        const id = String(profile.user_id);
        const username = String(profile.username || "@User");
        let avatar = "";
        if (profile.profile_photo) {
          avatar = '<img src="' + esc(profile.profile_photo) + '" alt="' + esc(username) + '" loading="lazy">';
        } else if (typeof xoxoBubbleImg === "function") {
          avatar = xoxoBubbleImg(id, username);
        } else {
          avatar = '<span aria-hidden="true" style="font-size:25px;font-weight:800;color:white">' + esc(username.replace(/^@+/, "").charAt(0).toUpperCase() || "U") + '</span>';
        }
        return '<button class="xoxo-online-person" type="button" data-xoxo-online-user="' + esc(id) + '" aria-label="' + esc(username + " — " + t.online) + '">' +
          '<span class="xoxo-online-avatar">' + avatar + '<span class="xoxo-online-dot"></span></span>' +
          '<span class="xoxo-online-name">' + esc(username) + '</span><span class="xoxo-online-status">' + esc(t.online) + '</span></button>';
      }).join("");

      section.innerHTML = '<div class="xoxo-online-head"><h3 class="xoxo-online-title">' + t.title + '</h3><span class="xoxo-online-live">LIVE</span></div><p class="xoxo-online-subtitle">' + t.subtitle + '</p><div class="xoxo-online-list">' + cards + '</div>';
      section.querySelectorAll("[data-xoxo-online-user]").forEach(button => {
        button.addEventListener("click", () => {
          const id = button.getAttribute("data-xoxo-online-user");
          if (id && typeof openPublicProfile === "function") openPublicProfile(id);
        });
      });
    } catch (error) {
      console.error("XOXO Online Now load failed:", error);
      if (!section.dataset.ready) section.remove();
    }
    section.dataset.ready = "1";
  }

  function start() {
    ensureStyles();
    heartbeat();
    loadOnlinePeople();
    window.setInterval(() => {
      if (document.visibilityState === "visible") {
        heartbeat();
        loadOnlinePeople();
      }
    }, REFRESH_MS);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        heartbeat();
        loadOnlinePeople();
      }
    });
    const observer = new MutationObserver(mutations => {
      const suggestionsChanged = mutations.some(mutation => {
        const target = mutation.target;
        return target && target.nodeType === 1 &&
          (target.id === "friendSuggestionsList" ||
           (typeof target.closest === "function" && target.closest("#friendSuggestionsList")));
      });
      if (suggestionsChanged || (!document.getElementById("xoxoOnlineNowSection") && findAnchor())) {
        loadOnlinePeople();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();