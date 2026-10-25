/* XOXO Avenue — Stay Safe, Sweetheart! Admin report adapter BETA.
 * Isolated data adapter for the EXISTING xmmReportsList and
 * openXoxoDmConversation(c) moderator UI, NOT a second message viewer.
 * Not referenced by index.html or production.
 *
 * The server enforces moderator authorization and an active verified PIN
 * on all new conversation-report metadata and status RPCs.
 */
(function (root) {
  "use strict";
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const STATUS = new Set(["pending", "reviewed", "resolved", "dismissed"]);
  const REASON_CODES = Object.freeze([
    "Scam or money requests",
    "Threats or blackmail",
    "Harassment or unwanted messages",
    "Fake profile or identity",
    "Intimate photo threats",
    "Other"
  ]);
  function isUuid(value) {
    return typeof value === "string" && UUID.test(value);
  }
  function normalizeLegacy(report) {
    if (!isUuid(report?.id) || !isUuid(report?.message_id) ||
        !isUuid(report?.reporter_id) || !isUuid(report?.reported_user_id)) return null;
    return {
      ...report, kind: "single_message",
      status: STATUS.has(report.status) ? report.status : "pending",
      evidenceIds: [report.message_id],
      reasonLabel: String(report.reason || "Other")
    };
  }
  function normalizeConversation(report) {
    if (!isUuid(report?.id) || !isUuid(report?.reporter_id) ||
        !isUuid(report?.reported_user_id) ||
        report.reporter_id.toLowerCase() === report.reported_user_id.toLowerCase() ||
        !Number.isInteger(report.reason_code) ||
        report.reason_code < 0 || report.reason_code >= REASON_CODES.length ||
        !Array.isArray(report.message_ids) || report.message_ids.length < 1 ||
        report.message_ids.length > 20 || report.message_ids.some(id => !isUuid(id)) ||
        new Set(report.message_ids.map(id => id.toLowerCase())).size !== report.message_ids.length) {
      return null;
    }
    return {
      id: report.id,
      kind: "conversation",
      reporter_id: report.reporter_id,
      reported_user_id: report.reported_user_id,
      reason_code: report.reason_code,
      reasonLabel: REASON_CODES[report.reason_code],
      details: typeof report.details === "string" ? report.details : "",
      created_at: report.created_at,
      status: STATUS.has(report.status) ? report.status : "pending",
      evidenceIds: report.message_ids.slice()
    };
  }
  function combine(legacy, conversations) {
    const items = [];
    for (const r of legacy || []) {
      const normalized = normalizeLegacy(r);
      if (normalized) items.push(normalized);
    }
    for (const r of conversations || []) {
      const normalized = normalizeConversation(r);
      if (normalized) items.push(normalized);
    }
    // Preserve both report sources; do not dedupe two distinct reports.
    return items.sort((a, b) =>
      (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0));
  }
  async function load({ client } = {}) {
    if (typeof client?.rpc !== "function") return { ok: false, reason: "invalid_client" };
    // Deliberately keep legacy report data if BETA RPC fails: no regression
    // to currently working individual-message reports.
    let old;
    try {
      const response = await client.rpc("get_xoxo_dm_reports");
      if (response.error || !Array.isArray(response.data)) {
        return { ok: false, reason: "legacy_reports_unavailable" };
      }
      old = response.data;
    } catch (_) {
      return { ok: false, reason: "legacy_reports_unavailable" };
    }
    try {
      const { data, error } = await client.rpc("xoxo_admin_list_conversation_reports_beta");
      if (error || !Array.isArray(data)) {
        return {
          ok: false, reason: "beta_reports_unavailable",
          legacyRows: combine(old, [])
        };
      }
      return { ok: true, rows: combine(old, data) };
    } catch (_) {
      return {
        ok: false, reason: "beta_reports_unavailable",
        legacyRows: combine(old, [])
      };
    }
  }
  async function updateStatus({ client, report, status } = {}) {
    if (typeof client?.rpc !== "function" || !isUuid(report?.id) ||
        !STATUS.has(status)) return { ok: false, reason: "invalid_input" };
    const rpc = report.kind === "conversation"
      ? "xoxo_admin_update_conversation_report_beta"
      : report.kind === "single_message"
        ? "update_xoxo_dm_report_status"
        : null;
    if (!rpc) return { ok: false, reason: "invalid_input" };
    try {
      const { data, error } = await client.rpc(rpc, {
        p_report_id: report.id, p_status: status
      });
      return error || data !== true
        ? { ok: false, reason: "update_failed" }
        : { ok: true, status };
    } catch (_) {
      return { ok: false, reason: "update_failed" };
    }
  }
  async function openInExistingViewer(report, openConversation) {
    if (report?.kind !== "conversation" ||
        !isUuid(report.reporter_id) ||
        !isUuid(report.reported_user_id) ||
        report.reporter_id.toLowerCase() === report.reported_user_id.toLowerCase() ||
        typeof openConversation !== "function") {
      return { ok: false, reason: "invalid_input" };
    }
    // Must call the *existing* openXoxoDmConversation, which asks for PIN
    // + moderation reason and invokes xoxo_admin_read_dm_page_pin.
    // This adapter NEVER queries private direct_messages.
    try {
      await openConversation({
        user_1: report.reporter_id,
        user_2: report.reported_user_id
      });
      // The existing viewer returns void even when a PIN prompt is cancelled.
      // A handoff is not proof that private messages were opened.
      return { ok: true, handedOff: true };
    } catch (_) {
      return { ok: false, reason: "existing_viewer_unavailable" };
    }
  }
  const API = Object.freeze({ load, combine, updateStatus, openInExistingViewer, REASON_CODES });
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  root.XOXOSafetyAdminAdapterBeta = API;
})(typeof window !== "undefined" ? window : globalThis);
