/* XOXO Avenue — Stay Safe, Sweetheart! Admin report bridge (BETA).
 * Adds report METADATA to the EXISTING #xmmReportsList after its normal render.
 * Never reads or renders DM content. Never creates another conversation viewer.
 * The host must pass its existing openXoxoDmConversation() via onOpenConversation.
 * Server RPCs enforce the established moderation PIN session and admin role.
 * This script is not loaded by index.html or production.
 */
(function (root, factory) {
  "use strict";
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.XOXOAdminConversationReportsBeta = Object.freeze(api);
})(typeof window !== "undefined" ? window : null, function (root) {
  "use strict";
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const STATUSES = ["pending", "reviewed", "resolved", "dismissed"];
  const copy = {
    en: {title:"Conversation reports",user:"Reported by",peer:"Reported user",reason:"Reason",evidence:"Selected evidence",details:"Details",none:"No details provided",view:"Open in existing moderation viewer",loading:"Loading conversation reports…",locked:"Unlock moderation to view conversation reports.",unlock:"Unlock moderation",failed:"Could not load conversation reports.",saveFailed:"Could not update the report.",status:"Change status",states:["Pending","Reviewed","Resolved","Dismissed"]},
    es: {title:"Denuncias de conversaciones",user:"Denunciante",peer:"Usuario denunciado",reason:"Motivo",evidence:"Pruebas seleccionadas",details:"Detalles",none:"Sin detalles",view:"Abrir en el visor de moderación existente",loading:"Cargando denuncias…",locked:"Desbloquea la moderación para ver las denuncias.",unlock:"Desbloquear moderación",failed:"No se pudieron cargar las denuncias.",saveFailed:"No se pudo actualizar la denuncia.",status:"Cambiar estado",states:["Pendiente","Revisada","Resuelta","Descartada"]},
    "pt-BR": {title:"Denúncias de conversas",user:"Denunciado por",peer:"Usuário denunciado",reason:"Motivo",evidence:"Provas selecionadas",details:"Detalhes",none:"Sem detalhes",view:"Abrir no visualizador de moderação existente",loading:"Carregando denúncias…",locked:"Desbloqueie a moderação para ver as denúncias.",unlock:"Desbloquear moderação",failed:"Não foi possível carregar as denúncias.",saveFailed:"Não foi possível atualizar a denúncia.",status:"Alterar status",states:["Pendente","Revisada","Resolvida","Dispensada"]},
    fr: {title:"Signalements de conversations",user:"Signalé par",peer:"Utilisateur signalé",reason:"Motif",evidence:"Preuves sélectionnées",details:"Détails",none:"Aucun détail",view:"Ouvrir dans le lecteur de modération existant",loading:"Chargement des signalements…",locked:"Déverrouille la modération pour voir les signalements.",unlock:"Déverrouiller la modération",failed:"Impossible de charger les signalements.",saveFailed:"Impossible de mettre à jour le signalement.",status:"Changer le statut",states:["En attente","Examiné","Résolu","Rejeté"]},
    pl: {title:"Zgłoszenia rozmów",user:"Zgłaszający",peer:"Zgłoszony użytkownik",reason:"Powód",evidence:"Wybrane dowody",details:"Szczegóły",none:"Brak szczegółów",view:"Otwórz w istniejącym podglądzie moderacji",loading:"Ładowanie zgłoszeń…",locked:"Odblokuj moderację, aby zobaczyć zgłoszenia.",unlock:"Odblokuj moderację",failed:"Nie udało się pobrać zgłoszeń.",saveFailed:"Nie udało się zaktualizować zgłoszenia.",status:"Zmień status",states:["Oczekujące","Sprawdzone","Rozwiązane","Odrzucone"]},
    de: {title:"Gesprächsmeldungen",user:"Gemeldet von",peer:"Gemeldeter Nutzer",reason:"Grund",evidence:"Ausgewählte Beweise",details:"Details",none:"Keine Details",view:"Im vorhandenen Moderationsfenster öffnen",loading:"Meldungen werden geladen…",locked:"Schalte die Moderation frei, um Meldungen anzusehen.",unlock:"Moderation freischalten",failed:"Meldungen konnten nicht geladen werden.",saveFailed:"Meldung konnte nicht aktualisiert werden.",status:"Status ändern",states:["Ausstehend","Geprüft","Gelöst","Abgewiesen"]},
    cs: {title:"Nahlášené konverzace",user:"Nahlásil(a)",peer:"Nahlášený uživatel",reason:"Důvod",evidence:"Vybrané důkazy",details:"Podrobnosti",none:"Bez podrobností",view:"Otevřít ve stávajícím moderátorském prohlížeči",loading:"Načítání hlášení…",locked:"Odemkni moderaci pro zobrazení hlášení.",unlock:"Odemknout moderaci",failed:"Hlášení nelze načíst.",saveFailed:"Hlášení nelze aktualizovat.",status:"Změnit stav",states:["Čeká","Zkontrolováno","Vyřešeno","Zamítnuto"]},
    no: {title:"Rapporter om samtaler",user:"Rapportert av",peer:"Rapportert bruker",reason:"Årsak",evidence:"Valgte bevis",details:"Detaljer",none:"Ingen detaljer",view:"Åpne i eksisterende modereringsvisning",loading:"Laster rapporter…",locked:"Lås opp moderering for å se rapporter.",unlock:"Lås opp moderering",failed:"Kunne ikke laste rapporter.",saveFailed:"Kunne ikke oppdatere rapporten.",status:"Endre status",states:["Venter","Gjennomgått","Løst","Avvist"]},
    sv: {title:"Anmälningar av konversationer",user:"Anmält av",peer:"Anmäld användare",reason:"Orsak",evidence:"Valda bevis",details:"Detaljer",none:"Inga detaljer",view:"Öppna i den befintliga modereringsvyn",loading:"Laddar anmälningar…",locked:"Lås upp modereringen för att se anmälningar.",unlock:"Lås upp modereringen",failed:"Det gick inte att läsa in anmälningarna.",saveFailed:"Det gick inte att uppdatera anmälan.",status:"Ändra status",states:["Väntar","Granskad","Löst","Avvisad"]},
    it: {title:"Segnalazioni delle conversazioni",user:"Segnalato da",peer:"Utente segnalato",reason:"Motivo",evidence:"Prove selezionate",details:"Dettagli",none:"Nessun dettaglio",view:"Apri nel visualizzatore di moderazione esistente",loading:"Caricamento segnalazioni…",locked:"Sblocca la moderazione per vedere le segnalazioni.",unlock:"Sblocca moderazione",failed:"Impossibile caricare le segnalazioni.",saveFailed:"Impossibile aggiornare la segnalazione.",status:"Cambia stato",states:["In attesa","Esaminata","Risolta","Respinta"]}
  };
  function language(value) {
    const locale = String(value || "en");
    if (/^(nb|nn|no)(-|$)/i.test(locale)) return "no";
    if (/^pt(-|$)/i.test(locale)) return "pt-BR";
    return copy[locale] ? locale : copy[locale.split("-")[0]] ? locale.split("-")[0] : "en";
  }
  const validId = value => typeof value === "string" && UUID.test(value);
  const validReport = r => r && validId(r.id) && validId(r.reporter_id) &&
    validId(r.reported_user_id) && r.reporter_id !== r.reported_user_id &&
    Number.isInteger(r.reason_code) && r.reason_code >= 0 && r.reason_code <= 5 &&
    STATUSES.includes(r.status) && Array.isArray(r.message_ids) &&
    r.message_ids.length >= 1 && r.message_ids.length <= 20 &&
    r.message_ids.every(validId);

  function create({ client, locale = "en", onOpenConversation, onUnlock, onError } = {}) {
    if (typeof client?.rpc !== "function" || typeof onOpenConversation !== "function") {
      throw new TypeError("A user-scoped Supabase client and existing conversation opener are required");
    }
    const lng = language(locale), t = copy[lng];
    let loading = false;

    async function listReports() {
      try {
        const { data, error } = await client.rpc("xoxo_admin_list_conversation_reports_beta");
        if (error || !Array.isArray(data)) return { ok: false, reason: "access_denied_or_unavailable" };
        return { ok: true, reports: data.filter(validReport) };
      } catch { return { ok: false, reason: "access_denied_or_unavailable" }; }
    }
    async function setStatus(reportId, status) {
      if (!validId(reportId) || !STATUSES.includes(status)) return { ok: false, reason: "invalid_input" };
      try {
        const { data, error } = await client.rpc("xoxo_admin_update_conversation_report_beta", {
          p_report_id: reportId, p_status: status
        });
        return data === true && !error ? { ok: true } : { ok: false, reason: "update_failed" };
      } catch { return { ok: false, reason: "update_failed" }; }
    }

    function node(doc, tag, text, cls) {
      const el = doc.createElement(tag);
      if (cls) el.className = cls;
      if (text !== undefined && text !== null) el.textContent = String(text);
      return el;
    }

    async function attach(container) {
      if (!container || typeof container.append !== "function" || loading) return false;
      loading = true;
      const doc = container.ownerDocument || root?.document;
      const old = container.querySelector('[data-xoxo-conversation-reports-beta]');
      if (old) old.remove();
      const section = node(doc, "section", null, "xmm-report-beta-section");
      section.dataset.xoxoConversationReportsBeta = "";
      section.append(node(doc, "h3", "💜 " + t.title));
      const message = node(doc, "p", t.loading, "xmm-report-feedback");
      section.append(message);
      container.append(section);
      let result;
      try { result = await listReports(); }
      finally { loading = false; }
      if (!section.isConnected) return false;
      if (!result.ok) {
        message.textContent = typeof onUnlock === "function" ? t.locked : t.failed;
        if (typeof onUnlock === "function") {
          const unlock = node(doc, "button", t.unlock);
          unlock.type = "button";
          unlock.addEventListener("click", async () => {
            unlock.disabled = true;
            try {
              if (await onUnlock()) await attach(container);
              else unlock.disabled = false;
            } catch {
              unlock.disabled = false;
              if (typeof onError === "function") onError("pin_failed");
            }
          });
          section.append(unlock);
        }
        return false;
      }
      message.remove();
      const reports = result.reports;
      if (!reports.length) {
        section.append(node(doc, "p", t.none, "xmm-report-feedback"));
        return true;
      }
      // Avoid simultaneously showing the existing "No private-message reports"
      // placeholder when the separate BETA conversation-report queue has data.
      const existingEmpty = Array.from(container.querySelectorAll(".xmm-report-feedback")).find(
        el => el !== message && el.textContent.trim() === "💜 No private-message reports yet."
      );
      if (existingEmpty) existingEmpty.remove();

      for (const r of reports) {
        const card = node(doc, "article", null, "xmm-report-card");
        card.append(node(doc, "strong", "🚩 " + t.title + " · " + r.id.slice(0, 8)));
        card.append(node(doc, "div", t.user + ": " + r.reporter_id + " · " +
          t.peer + ": " + r.reported_user_id, "xmm-report-meta"));
        const translatedReasons = root?.XOXOReportFormBeta?.translations;
        const reasons = translatedReasons?.[lng]?.reasons || translatedReasons?.en?.reasons;
        const reason = Array.isArray(reasons) && reasons[r.reason_code]
          ? reasons[r.reason_code] : String(r.reason_code);
        card.append(node(doc, "div", t.reason + ": " + reason +
          " · " + t.evidence + ": " + r.message_ids.length, "xmm-report-meta"));
        card.append(node(doc, "div", t.details + ": " + (r.details?.trim() || t.none), "xmm-report-details"));
        const actions = node(doc, "div", null, "xmm-report-actions");
        const view = node(doc, "button", t.view);
        view.type = "button";
        view.addEventListener("click", () => {
          // Hand ONLY the user pair to the existing PIN-gated, audited viewer.
          // The host resolves these IDs against its current conversation list.
          onOpenConversation({ user_1: r.reporter_id, user_2: r.reported_user_id });
        });
        actions.append(view);
        for (const [i, status] of STATUSES.entries()) {
          if (r.status === status) continue;
          const button = node(doc, "button", t.status + ": " + t.states[i]);
          button.type = "button";
          button.addEventListener("click", async () => {
            const prompt = typeof root?.confirm === "function"
              ? root.confirm(t.status + ": " + t.states[i] + "?") : false;
            if (!prompt) return;
            for (const control of actions.querySelectorAll("button")) control.disabled = true;
            const result = await setStatus(r.id, status);
            if (result.ok) await attach(container);
            else {
              for (const control of actions.querySelectorAll("button")) control.disabled = false;
              if (typeof onError === "function") onError("update_failed");
            }
          });
          actions.append(button);
        }
        card.append(actions);
        section.append(card);
      }
      return true;
    }
    return Object.freeze({ listReports, setStatus, attach });
  }
  return Object.freeze({ create, translations: copy });
});
