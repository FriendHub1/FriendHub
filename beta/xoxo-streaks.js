/* XOXO Avenue — XOXO Streaks BETA
 * UI-only client module. It uses the authenticated Supabase client and the
 * server-side RPC; it never calculates or writes streak state in the browser.
 */
(function (root) {
  "use strict";

  const COPY = Object.freeze({
    en: { label: "XOXO STREAK", day: "day", days: "days", next: "Next milestone", longest: "Best streak", empty: "Start your XOXO streak by messaging each other today." },
    es: { label: "RACHA XOXO", day: "día", days: "días", next: "Próximo logro", longest: "Mejor racha", empty: "Empiecen su racha XOXO escribiéndose hoy." },
    "pt-BR": { label: "SEQUÊNCIA XOXO", day: "dia", days: "dias", next: "Próxima conquista", longest: "Melhor sequência", empty: "Comecem sua sequência XOXO trocando mensagens hoje." },
    de: { label: "XOXO-SERIE", day: "Tag", days: "Tage", next: "Nächster Meilenstein", longest: "Längste Serie", empty: "Startet eure XOXO-Serie, indem ihr euch heute schreibt." },
    nb: { label: "XOXO-REKKE", day: "dag", days: "dager", next: "Neste milepæl", longest: "Beste rekke", empty: "Start XOXO-rekken ved å sende hverandre meldinger i dag." },
    pl: { label: "SERIA XOXO", day: "dzień", days: "dni", next: "Następny etap", longest: "Najdłuższa seria", empty: "Rozpocznijcie serię XOXO, pisząc do siebie dzisiaj." },
    fr: { label: "SÉRIE XOXO", day: "jour", days: "jours", next: "Prochain palier", longest: "Meilleure série", empty: "Lancez votre série XOXO en vous écrivant aujourd’hui." },
    cs: { label: "SÉRIE XOXO", day: "den", days: "dny", next: "Další milník", longest: "Nejdelší série", empty: "Začněte svou sérii XOXO tím, že si dnes napíšete." },
    sv: { label: "XOXO-SVIT", day: "dag", days: "dagar", next: "Nästa milstolpe", longest: "Bästa svit", empty: "Starta er XOXO-svit genom att skriva till varandra idag." },
    it: { label: "SERIE XOXO", day: "giorno", days: "giorni", next: "Prossimo traguardo", longest: "Serie migliore", empty: "Iniziate la vostra serie XOXO scrivendovi oggi." }
  });
  const MILESTONES = Object.freeze([3, 7, 14, 30, 100]);

  function localeKey(value) {
    const raw = String(value || "en");
    if (/^(nb|nn|no)(-|$)/i.test(raw)) return "nb";
    if (/^pt(-|$)/i.test(raw)) return "pt-BR";
    const key = raw.toLowerCase().split("-")[0];
    return Object.keys(COPY).find(k => k.toLowerCase() === key) || "en";
  }

  function formatDays(value, copy) {
    const n = Math.max(0, Number(value) || 0);
    return n + " " + (n === 1 ? copy.day : copy.days);
  }

  function create(options) {
    if (!options || !options.client || !options.accountId || !options.otherUserId ||
        options.accountId === options.otherUserId || !options.mount ||
        typeof options.mount.replaceChildren !== "function") return null;

    const copy = COPY[localeKey(options.locale)];
    let destroyed = false;
    let requestToken = 0;

    async function refresh() {
      const token = ++requestToken;
      if (destroyed || (typeof options.isCurrent === "function" && !options.isCurrent())) return false;
      try {
        const result = await options.client.rpc("xoxo_get_dm_streak", {
          p_other_user: options.otherUserId
        });
        if (destroyed || token !== requestToken ||
            (typeof options.isCurrent === "function" && !options.isCurrent())) return false;
        if (result?.error) throw result.error;
        const row = Array.isArray(result?.data) ? result.data[0] : result?.data;
        if (typeof options.isCurrent === "function" && !options.isCurrent()) return false;
        if (!row) {
          options.mount.replaceChildren();
          return false;
        }
        const current = Math.max(0, Number(row.current_streak) || 0);
        const longest = Math.max(0, Number(row.longest_streak) || 0);
        const next = Number(row.next_milestone) || MILESTONES.find(n => n > current) || 100;

        const card = document.createElement("section");
        card.setAttribute("data-xoxo-streak-beta", "");
        card.setAttribute("aria-label", copy.label);
        card.style.cssText = "box-sizing:border-box;display:flex;align-items:center;gap:12px;width:100%;margin:8px 0;padding:12px 14px;border:1px solid #76509a;border-radius:16px;background:linear-gradient(110deg,#211233,#321344);color:#fff5ff;font:inherit";
        const icon = document.createElement("div");
        icon.textContent = "🔥";
        icon.setAttribute("aria-hidden", "true");
        icon.style.cssText = "font-size:27px;line-height:1";
        const content = document.createElement("div");
        content.style.cssText = "min-width:0;flex:1";
        const title = document.createElement("div");
        title.textContent = copy.label;
        title.style.cssText = "font-size:10px;letter-spacing:1.5px;font-weight:800;color:#ffe28a";
        const count = document.createElement("div");
        count.textContent = current > 0 ? formatDays(current, copy) : copy.empty;
        count.style.cssText = "font-size:16px;font-weight:750;margin-top:3px;overflow-wrap:anywhere";
        content.append(title, count);
        if (current > 0) {
          const details = document.createElement("div");
          details.style.cssText = "font-size:11px;color:#e0c9f5;margin-top:4px";
          details.textContent = copy.next + ": " + next + " · " + copy.longest + ": " + formatDays(longest, copy);
          content.append(details);
        }
        card.append(icon, content);
        options.mount.replaceChildren(card);
        return true;
      } catch (error) {
        // Fail closed: don't expose database details or private conversation data.
        if (!destroyed && token === requestToken) options.mount.replaceChildren();
        if (typeof options.onError === "function") {
          try { options.onError("streak_unavailable"); } catch (_) {}
        }
        return false;
      }
    }

    return Object.freeze({
      refresh,
      destroy() {
        destroyed = true;
        requestToken++;
        options.mount.replaceChildren();
      }
    });
  }

  root.XOXOStreaksBeta = Object.freeze({
    version: "0.1.0-beta",
    locales: Object.freeze(["en", "es", "pt-BR", "de", "nb", "pl", "fr", "cs", "sv", "it"]),
    milestones: MILESTONES,
    translations: COPY,
    localeKey,
    create
  });
})(typeof window !== "undefined" ? window : globalThis);
