/* XOXO Avenue — Stay Safe, Sweetheart! BETA browser coordinator.
 * NOT loaded by index.html or production.
 *
 * Required browser scripts, in order:
 *   stay-safe-sweetheart.js
 *   stay-safe-report-form.js
 *   stay-safe-evidence-picker.js
 *   stay-safe-browser-bridge.js
 *
 * Call XOXOStaySafeBridgeBeta.create({ getClient, getVisibleMessages, onResult }).
 * getClient MUST return the current logged-in user's Supabase client, never
 * a service-role client. getVisibleMessages returns ONLY already-visible
 * messages for the active conversation, each with id, sender_id,
 * recipient_id, text or content (optional attachment_type).
 *
 * This browser preflight is defense-in-depth, NOT authorization.
 * The server-side RPC MUST independently enforce all permissions.
 * No RPC is installed or invoked merely by loading this file.
 */
(function (root) {
  "use strict";

  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const MAX_EVIDENCE = 20;
  const MAX_PREVIEW = 100;
  const MAX_DETAILS = 2000;
  const LOCALE_ALIASES = Object.freeze({
    pt: "pt-BR", "pt-br": "pt-BR", nb: "no", "nb-no": "no",
    nn: "no", cs: "cs", cz: "cs"
  });
  const SUPPORTED = new Set(["en", "es", "pt-BR", "de", "no", "pl", "fr", "cs", "sv", "it"]);

  function localeFor(value) {
    const name = String(value || "en").trim();
    const normalized = LOCALE_ALIASES[name.toLowerCase()] || name;
    const language = SUPPORTED.has(normalized) ? normalized : normalized.split("-")[0];
    return SUPPORTED.has(language) ? language : "en";
  }
  function isUuid(value) {
    return typeof value === "string" && UUID.test(value);
  }
  function error(reason) {
    return { ok: false, reason };
  }
  function normalizedIds(messageIds) {
    if (!Array.isArray(messageIds) || messageIds.length < 1 ||
        messageIds.length > MAX_EVIDENCE || messageIds.some(id => !isUuid(id))) {
      return null;
    }
    const ids = messageIds.map(id => id.toLowerCase());
    return new Set(ids).size === ids.length ? ids : null;
  }
  function samePair(message, self, other) {
    if (!message || !isUuid(message.sender_id) || !isUuid(message.recipient_id)) {
      return false;
    }
    const from = message.sender_id.toLowerCase();
    const to = message.recipient_id.toLowerCase();
    return (from === self && to === other) || (from === other && to === self);
  }

  function create({
    getClient,
    getVisibleMessages,
    onResult,
    ui,
    generateId
  } = {}) {
    if (typeof getClient !== "function" ||
        typeof getVisibleMessages !== "function" ||
        typeof onResult !== "function") {
      throw new TypeError("BETA bridge requires getClient, getVisibleMessages and onResult");
    }
    const dialogs = ui || {
      reminder: root.XOXOSafetyReminderBeta,
      form: root.XOXOReportFormBeta,
      evidence: root.XOXOEvidencePickerBeta
    };
    let sending = false;

    function deliver(result) {
      // The host owns toast/notification UX and decides how to display it.
      try { onResult(result); } catch (_) { /* UI feedback must not undo RPC result */ }
      return result;
    }
    function createKey() {
      const key = typeof generateId === "function" ? generateId() : root.crypto?.randomUUID?.();
      return isUuid(key) ? key.toLowerCase() : null;
    }
    async function authenticatedClient(accountId) {
      try {
        const client = await getClient();
        if (typeof client?.auth?.getUser !== "function" ||
            typeof client?.from !== "function" ||
            typeof client?.rpc !== "function") {
          return { ok: false, reason: "invalid_client" };
        }
        const { data, error: authError } = await client.auth.getUser();
        const user = data?.user?.id;
        if (authError || !isUuid(user) || user.toLowerCase() !== accountId) {
          return { ok: false, reason: "authentication_failed" };
        }
        return { ok: true, client };
      } catch (_) {
        return error("authentication_failed");
      }
    }
    async function submit({
      accountId, otherUserId, reasonCode, details = "", messageIds,
      idempotencyKey
    } = {}) {
      if (!isUuid(accountId) || !isUuid(otherUserId) ||
          accountId.toLowerCase() === otherUserId.toLowerCase() ||
          !Number.isInteger(reasonCode) || reasonCode < 0 || reasonCode > 5 ||
          typeof details !== "string" || details.length > MAX_DETAILS) {
        return error("invalid_input");
      }
      const ids = normalizedIds(messageIds);
      const key = idempotencyKey || createKey();
      if (!ids || !isUuid(key)) return error("invalid_input");
      const self = accountId.toLowerCase();
      const other = otherUserId.toLowerCase();
      const auth = await authenticatedClient(self);
      if (!auth.ok) return auth;
      let rows;
      try {
        const response = await auth.client.from("direct_messages")
          .select("id,sender_id,recipient_id").in("id", ids);
        if (response.error || !Array.isArray(response.data)) {
          return error("evidence_unavailable");
        }
        rows = response.data;
      } catch (_) {
        return error("evidence_unavailable");
      }
      const found = new Set();
      for (const row of rows) {
        if (!isUuid(row?.id) || !ids.includes(row.id.toLowerCase()) ||
            !samePair(row, self, other) || found.has(row.id.toLowerCase())) {
          return error("evidence_not_authorized");
        }
        found.add(row.id.toLowerCase());
      }
      if (found.size !== ids.length || rows.length !== ids.length) {
        return error("evidence_not_authorized");
      }
      try {
        const { data, error: rpcError } = await auth.client.rpc(
          "xoxo_submit_conversation_report_beta",
          {
            p_other_user_id: other,
            p_reason_code: reasonCode,
            p_details: details,
            p_message_ids: ids,
            p_idempotency_key: key.toLowerCase()
          }
        );
        return rpcError || !isUuid(data) ?
          error("submission_failed") : { ok: true, reportId: data };
      } catch (_) {
        return error("submission_failed");
      }
    }

    function selectableMessages(messages, accountId, otherUserId) {
      if (!Array.isArray(messages)) return [];
      const self = accountId.toLowerCase();
      const other = otherUserId.toLowerCase();
      const used = new Set();
      const safe = [];
      for (const message of messages) {
        if (!isUuid(message?.id) || !samePair(message, self, other)) continue;
        const id = message.id.toLowerCase();
        if (used.has(id)) continue;
        const text = typeof message.text === "string" ? message.text :
                     typeof message.content === "string" ? message.content : "";
        const kind = message.attachment_type;
        const label = text.trim() || (
          kind === "image" || kind === "video" || kind === "audio"
            ? "📎 " + kind : ""
        );
        if (!label) continue;
        used.add(id);
        safe.push({ id, text: label });
        if (safe.length === MAX_PREVIEW) break;
      }
      return safe;
    }

    async function startReport({
      conversationId, accountId, otherUserId, locale = "en"
    } = {}) {
      if (typeof conversationId !== "string" || !conversationId ||
          !isUuid(accountId) || !isUuid(otherUserId) ||
          accountId.toLowerCase() === otherUserId.toLowerCase()) {
        return error("invalid_input");
      }
      if (typeof dialogs?.form?.open !== "function" ||
          typeof dialogs?.evidence?.open !== "function") {
        return error("ui_unavailable");
      }
      const auth = await authenticatedClient(accountId.toLowerCase());
      if (!auth.ok) return deliver(auth);
      const language = localeFor(locale);
      const opened = dialogs.form.open({
        conversationId, locale: language,
        onContinue: async (form) => {
          if (form?.conversationId !== conversationId ||
              !Number.isInteger(form.reasonCode) || form.reasonCode < 0 ||
              form.reasonCode > 5 || typeof form.details !== "string" ||
              form.details.length > MAX_DETAILS) {
            deliver(error("invalid_input"));
            return;
          }
          let messages;
          try {
            messages = await getVisibleMessages({
              conversationId,
              accountId,
              otherUserId
            });
          } catch (_) {
            deliver(error("messages_unavailable"));
            return;
          }
          const safe = selectableMessages(messages, accountId, otherUserId);
          if (!safe.length) {
            deliver(error("no_evidence"));
            return;
          }
          const allowed = new Set(safe.map(m => m.id));
          const pickerOpened = dialogs.evidence.open({
            conversationId,
            messages: safe,
            locale: language,
            onContinue: async (choice) => {
              if (sending) return;
              if (choice?.conversationId !== conversationId) {
                deliver(error("invalid_input"));
                return;
              }
              const ids = normalizedIds(choice.messageIds);
              if (!ids || ids.some(id => !allowed.has(id))) {
                deliver(error("invalid_input"));
                return;
              }
              sending = true;
              try {
                const result = await submit({
                  accountId,
                  otherUserId,
                  reasonCode: form.reasonCode,
                  details: form.details,
                  messageIds: ids
                });
                deliver(result);
              } finally {
                sending = false;
              }
            }
          });
          if (!pickerOpened) deliver(error("ui_unavailable"));
        }
      });
      return opened ? { ok: true, opened: true } : error("ui_unavailable");
    }

    function showSafetyNotice({
      conversationId, accountId, otherUserId, locale = "en"
    } = {}) {
      if (!isUuid(accountId) || !isUuid(otherUserId) ||
          typeof conversationId !== "string" || !conversationId ||
          typeof dialogs?.reminder?.show !== "function") {
        return false;
      }
      return dialogs.reminder.show({
        conversationId,
        accountId,
        locale: localeFor(locale),
        onReport: () => {
          void startReport({
            conversationId, accountId, otherUserId, locale
          }).then(result => {
            if (!result?.ok) deliver(result);
          }).catch(() => deliver(error("ui_unavailable")));
        }
      });
    }
    return Object.freeze({ submit, startReport, showSafetyNotice });
  }

  const API = Object.freeze({ create, localeFor });
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  root.XOXOStaySafeBridgeBeta = API;
})(typeof window !== "undefined" ? window : globalThis);
