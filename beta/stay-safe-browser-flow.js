/* XOXO Avenue — Stay Safe, Sweetheart! BETA browser flow.
 * Opt-in only: this file is NOT referenced by production/index.html.
 *
 * Host loads, in order:
 *   stay-safe-sweetheart.js
 *   stay-safe-report-form.js
 *   stay-safe-evidence-picker.js
 *   stay-safe-browser-report-adapter.js
 *   stay-safe-browser-flow.js
 *
 * Host calls XOXOSafetyFlowBeta.create({ client, accountId, otherUserId,
 *   conversationId, locale, getMessages, enabled, onStatus }).
 * getMessages supplies messages ALREADY loaded in the signed-in user's chat.
 * enabled MUST remain false until backend RPC is deployed and audited.
 * previewOnly=true allows trying the form/picker without ever writing reports.
 */
(function (root, factory) {
  "use strict";
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.XOXOSafetyFlowBeta = Object.freeze(api);
})(typeof window !== "undefined" ? window : null, function (root) {
  "use strict";
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const isId = value => typeof value === "string" && UUID.test(value);
  const STATUS = {
    es: { success: "Denuncia enviada de forma segura. 💜", disabled: "Las denuncias por conversación aún están en fase BETA.", failed: "No pudimos enviar la denuncia. Inténtalo de nuevo.", noMessages: "No hay mensajes disponibles para adjuntar.", missing: "El formulario de denuncia no está disponible.", attachment: "📎 Archivo adjunto" },
    en: { success: "Your report was sent securely. 💜", disabled: "Conversation reporting is not enabled yet.", failed: "Your report could not be sent. Please try again.", noMessages: "No messages are available to attach.", missing: "The report form is unavailable.", attachment: "📎 Attachment" },
    "pt-BR": { success: "Sua denúncia foi enviada com segurança. 💜", disabled: "A denúncia de conversas ainda está em BETA.", failed: "Não foi possível enviar a denúncia.", noMessages: "Não há mensagens para anexar.", missing: "O formulário não está disponível.", attachment: "📎 Anexo" },
    fr: { success: "Ton signalement a été envoyé en sécurité. 💜", disabled: "Le signalement de conversations est encore en BÊTA.", failed: "Impossible d'envoyer le signalement.", noMessages: "Aucun message à joindre.", missing: "Le formulaire n'est pas disponible.", attachment: "📎 Pièce jointe" },
    pl: { success: "Zgłoszenie zostało bezpiecznie wysłane. 💜", disabled: "Zgłaszanie rozmów jest jeszcze w wersji BETA.", failed: "Nie udało się wysłać zgłoszenia.", noMessages: "Brak wiadomości do załączenia.", missing: "Formularz zgłoszenia jest niedostępny.", attachment: "📎 Załącznik" },
    de: { success: "Deine Meldung wurde sicher gesendet. 💜", disabled: "Gesprächsmeldungen sind noch in der BETA.", failed: "Deine Meldung konnte nicht gesendet werden.", noMessages: "Keine Nachrichten zum Anhängen.", missing: "Das Meldeformular ist nicht verfügbar.", attachment: "📎 Anhang" },
    cs: { success: "Hlášení bylo bezpečně odesláno. 💜", disabled: "Hlášení konverzací je zatím ve verzi BETA.", failed: "Hlášení se nepodařilo odeslat.", noMessages: "Nejsou k dispozici zprávy k přiložení.", missing: "Formulář není dostupný.", attachment: "📎 Příloha" },
    no: { success: "Rapporten din ble sendt trygt. 💜", disabled: "Rapportering av samtaler er fortsatt i BETA.", failed: "Kunne ikke sende rapporten.", noMessages: "Ingen meldinger tilgjengelig.", missing: "Rapportskjemaet er utilgjengelig.", attachment: "📎 Vedlegg" },
    sv:{"success":"Din anmälan har skickats säkert. 💜","disabled":"Konversationsanmälningar är fortfarande i BETA.","failed":"Det gick inte att skicka anmälan. Försök igen.","noMessages":"Det finns inga meddelanden att bifoga.","missing":"Anmälningsformuläret är inte tillgängligt.","attachment":"📎 Bilaga"},
    it:{"success":"La tua segnalazione è stata inviata in sicurezza. 💜","disabled":"Le segnalazioni delle conversazioni sono ancora in BETA.","failed":"Impossibile inviare la segnalazione. Riprova.","noMessages":"Non ci sono messaggi da allegare.","missing":"Il modulo di segnalazione non è disponibile.","attachment":"📎 Allegato"}
  };
  const normalizeLocale = locale => {
    const value = String(locale || "en");
    if (value.toLowerCase() === "pt" || value.toLowerCase() === "pt-br") return "pt-BR";
    if (["nb", "nb-NO", "nn", "no-NO"].includes(value)) return "no";
    const short = value.split("-")[0];
    return STATUS[value] ? value : STATUS[short] ? short : "en";
  };

  function create(config) {
    if (!config || !isId(config.accountId) || !isId(config.otherUserId) ||
        config.accountId.toLowerCase() === config.otherUserId.toLowerCase() ||
        typeof config.conversationId !== "string" || !config.conversationId ||
        typeof config.getMessages !== "function") {
      throw new TypeError("Valid signed-in conversation context and getMessages are required");
    }
    const { client, accountId, otherUserId, conversationId, getMessages } = config;
    const locale = normalizeLocale(config.locale);
    const messages = STATUS[locale];
    const account = accountId.toLowerCase();
    const peer = otherUserId.toLowerCase();
    let sending = false;
    let retry = null;

    function inform(result) {
      if (typeof config.onStatus === "function") {
        config.onStatus(result);
        return;
      }
      const message = result.ok ? messages.success :
        result.reason === "disabled" ? messages.disabled :
        result.reason === "no_messages" ? messages.noMessages :
        result.reason === "missing_module" ? messages.missing : messages.failed;
      if (typeof root?.alert === "function") root.alert(message);
    }

    function normalizeLoadedMessage(row) {
      if (!row || !isId(row.id) || !isId(row.sender_id) || !isId(row.recipient_id)) return null;
      const from = row.sender_id.toLowerCase(), to = row.recipient_id.toLowerCase();
      if (!((from === account && to === peer) || (from === peer && to === account))) return null;
      const content = typeof row.text === "string" ? row.text :
        typeof row.content === "string" ? row.content : "";
      return { id: row.id.toLowerCase(), text: content || messages.attachment };
    }

    async function startEvidence(formData) {
      if (!config.enabled && !config.previewOnly) { inform({ ok: false, reason: "disabled" }); return; }
      if (!formData || formData.conversationId !== conversationId) {
        inform({ ok: false, reason: "invalid_conversation" }); return;
      }
      let visible;
      try { visible = await getMessages(); }
      catch { inform({ ok: false, reason: "no_messages" }); return; }
      if (!Array.isArray(visible)) { inform({ ok: false, reason: "no_messages" }); return; }
      const seen = new Set();
      const safe = [];
      for (const row of visible) {
        const item = normalizeLoadedMessage(row);
        if (item && !seen.has(item.id)) {
          seen.add(item.id);
          safe.push(item);
        }
      }
      if (!safe.length) { inform({ ok: false, reason: "no_messages" }); return; }
      if (typeof root?.XOXOEvidencePickerBeta?.open !== "function") {
        inform({ ok: false, reason: "missing_module" }); return;
      }
      const opened = root.XOXOEvidencePickerBeta.open({
        conversationId, messages: safe, locale,
        onContinue: selection => {
          if (!selection || selection.conversationId !== conversationId ||
              !Array.isArray(selection.messageIds) || selection.messageIds.length < 1 ||
              selection.messageIds.length > 20 || !selection.messageIds.every(isId) ||
              new Set(selection.messageIds.map(id => id.toLowerCase())).size !== selection.messageIds.length ||
              !selection.messageIds.every(id => seen.has(id.toLowerCase()))) {
            inform({ ok: false, reason: "invalid_evidence" }); return;
          }
          void send({
            otherUserId: peer, accountId: account,
            reasonCode: formData.reasonCode, details: formData.details,
            messageIds: selection.messageIds
          });
        }
      });
      if (!opened) inform({ ok: false, reason: "missing_module" });
    }

    async function send(input) {
      if (sending) return { ok: false, reason: "already_sending" };
      if (!config.enabled) {
        const result = { ok: false, reason: "disabled" };
        inform(result); return result;
      }
      const adapter = root?.XOXOReportSubmitBrowserBeta;
      if (typeof adapter?.submit !== "function" || !root?.crypto ||
          typeof root.crypto.randomUUID !== "function") {
        const result = { ok: false, reason: "missing_module" };
        inform(result); return result;
      }
      if (!input || !Number.isInteger(input.reasonCode) ||
          input.reasonCode < 0 || input.reasonCode > 5 ||
          typeof input.details !== "string" || input.details.length > 2000 ||
          !Array.isArray(input.messageIds) || input.messageIds.length < 1 ||
          input.messageIds.length > 20 || !input.messageIds.every(isId) ||
          new Set(input.messageIds.map(id => id.toLowerCase())).size !== input.messageIds.length) {
        const result = { ok: false, reason: "invalid_input" };
        inform(result); return result;
      }
      // Reuse the same key when retrying an identical failed submission.
      const fingerprint = JSON.stringify([
        peer, input.reasonCode, input.details,
        [...input.messageIds.map(id => id.toLowerCase())].sort()
      ]);
      if (!retry || retry.fingerprint !== fingerprint) {
        retry = { fingerprint, key: root.crypto.randomUUID() };
      }
      sending = true;
      let result;
      try {
        result = await adapter.submit(client, {
          ...input, accountId: account, otherUserId: peer,
          idempotencyKey: retry.key
        });
      } catch {
        result = { ok: false, reason: "submission_failed" };
      } finally {
        sending = false;
      }
      if (result?.ok) retry = null;
      inform(result);
      return result;
    }

    function openReport() {
      if (!config.enabled && !config.previewOnly) { inform({ ok: false, reason: "disabled" }); return false; }
      if (sending || typeof root?.XOXOReportFormBeta?.open !== "function") {
        if (!sending) inform({ ok: false, reason: "missing_module" });
        return false;
      }
      return root.XOXOReportFormBeta.open({
        conversationId, locale,
        onContinue: data => { void startEvidence(data); }
      });
    }

    function showReminder() {
      if (typeof root?.XOXOSafetyReminderBeta?.show !== "function") return false;
      return root.XOXOSafetyReminderBeta.show({
        conversationId, accountId, locale,
        ...((config.enabled || config.previewOnly) ? { onReport: () => { openReport(); } } : {})
      });
    }

    return Object.freeze({ showReminder, openReport });
  }

  return Object.freeze({ create });
});
