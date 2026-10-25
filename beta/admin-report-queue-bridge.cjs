/* XOXO Avenue — BETA adapter for the existing admin moderation panel.
 * Preserves Message Reports and links into the existing PIN-gated DM viewer.
 * New conversation-report RPCs are a proposed contract, NOT deployed.
 * Every RPC MUST enforce server-side admin authorization.
 */
(function(root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.XoxoAdminReportBridgeBeta = api;
})(this, function() {
  "use strict";
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const STATES = new Set(["pending", "reviewed", "resolved", "dismissed"]);
  const NEW_REASONS = Object.freeze([
    "Scam or money requests", "Threats or blackmail", "Harassment or unwanted messages",
    "Fake profile or identity", "Intimate photo threats", "Other"
  ]);
  const validId = v => typeof v === "string" && UUID.test(v);
  const safeString = v => typeof v === "string" ? v : "";
  const validState = v => STATES.has(v);
  function normalizeLegacy(row) {
    if (!row || !validId(row.id) || !validId(row.reporter_id) ||
        !validId(row.reported_user_id) || !validId(row.message_id)) return null;
    return {
      kind: "message", id: row.id, reporter_id: row.reporter_id,
      reported_user_id: row.reported_user_id, message_id: row.message_id,
      reason: safeString(row.reason), reason_code: null,
      details: safeString(row.details), status: validState(row.status) ? row.status : "pending",
      evidence_count: 1, created_at: safeString(row.created_at)
    };
  }
  function normalizeConversation(row) {
    if (!row || !validId(row.id) || !validId(row.reporter_id) ||
        !validId(row.other_user_id) || !Number.isInteger(row.reason_code) ||
        row.reason_code < 0 || row.reason_code >= NEW_REASONS.length) return null;
    const count = Number(row.evidence_count);
    if (!Number.isInteger(count) || count < 1 || count > 20) return null;
    return {
      kind: "conversation", id: row.id, reporter_id: row.reporter_id,
      reported_user_id: row.other_user_id, message_id: null,
      reason: NEW_REASONS[row.reason_code], reason_code: row.reason_code,
      details: safeString(row.details), status: validState(row.status) ? row.status : "pending",
      evidence_count: count, created_at: safeString(row.created_at)
    };
  }
  function sortNewestFirst(a, b) {
    const at = Date.parse(a.created_at), bt = Date.parse(b.created_at);
    return (Number.isFinite(bt) ? bt : 0) - (Number.isFinite(at) ? at : 0);
  }
  /**
   * The existing get_xoxo_dm_reports returns no message content.
   * Opt-in BETA RPC is disabled by default until its server authorization is audited.
   * Failure of the BETA RPC cannot hide successfully loaded historical reports.
   */
  async function loadQueue(client, {enableConversationBeta = false} = {}) {
    if (typeof client?.rpc !== "function") return {ok:false, reason:"invalid_client"};
    let legacy;
    try { legacy = await client.rpc("get_xoxo_dm_reports"); }
    catch { return {ok:false, reason:"legacy_queue_unavailable"}; }
    if (legacy?.error || !Array.isArray(legacy?.data))
      return {ok:false, reason:"legacy_queue_unavailable"};
    const reports = legacy.data.map(normalizeLegacy).filter(Boolean);
    if (!enableConversationBeta) return {ok:true, reports:reports.sort(sortNewestFirst), betaUnavailable:false};
    try {
      const beta = await client.rpc("get_xoxo_conversation_reports_beta_admin");
      if (beta?.error || !Array.isArray(beta?.data))
        return {ok:true, reports:reports.sort(sortNewestFirst), betaUnavailable:true};
      reports.push(...beta.data.map(normalizeConversation).filter(Boolean));
      return {ok:true, reports:reports.sort(sortNewestFirst), betaUnavailable:false};
    } catch {
      return {ok:true, reports:reports.sort(sortNewestFirst), betaUnavailable:true};
    }
  }
  /** Resolve metadata to an existing conversation. Opening it must STILL call
   * openXoxoDmConversation(), which verifies PIN and audits access server-side. */
  function findExistingConversation(report, conversations) {
    if (!report || !validId(report.reporter_id) || !validId(report.reported_user_id) ||
        !Array.isArray(conversations)) return null;
    return conversations.find(c => c && (
      (c.user_1 === report.reporter_id && c.user_2 === report.reported_user_id) ||
      (c.user_2 === report.reporter_id && c.user_1 === report.reported_user_id)
    )) || null;
  }
  /** Status changes are routed to the existing endpoint for legacy reports.
   * BETA status endpoint must be separately implemented with admin authorization. */
  async function updateStatus(client, report, status, {enableConversationBeta = false} = {}) {
    if (typeof client?.rpc !== "function" || !validId(report?.id) || !validState(status))
      return {ok:false, reason:"invalid_input"};
    let method, params;
    if (report.kind === "message") {
      method = "update_xoxo_dm_report_status";
      params = {p_report_id:report.id, p_status:status};
    } else if (report.kind === "conversation" && enableConversationBeta) {
      method = "update_xoxo_conversation_report_status_beta_admin";
      params = {p_report_id:report.id, p_status:status};
    } else return {ok:false, reason:"unsupported_report_kind"};
    try {
      const response = await client.rpc(method, params);
      if (response?.error || response?.data !== true)
        return {ok:false, reason:"status_update_failed"};
      return {ok:true};
    } catch { return {ok:false, reason:"status_update_failed"}; }
  }
  return Object.freeze({loadQueue, findExistingConversation, updateStatus});
});