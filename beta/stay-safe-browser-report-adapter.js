/* XOXO Avenue — Stay Safe, Sweetheart! browser RPC adapter (BETA).
 * Uses ONLY the existing user's authenticated Supabase client.
 * No service role, no background requests, no deployment side effects.
 * The server must independently authorize and atomically persist evidence.
 */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.XOXOReportSubmitBrowserBeta = Object.freeze(api);
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const validId = value => typeof value === "string" && UUID.test(value);

  async function currentAccount(client) {
    try {
      const response = await client.auth.getUser();
      if (response?.error || !validId(response?.data?.user?.id) ||
          response.data.user.is_anonymous === true) return null;
      return response.data.user.id.toLowerCase();
    } catch { return null; }
  }

  async function submit(client, input) {
    if (typeof client?.auth?.getUser !== "function" ||
        typeof client?.from !== "function" || typeof client?.rpc !== "function") {
      return { ok: false, reason: "invalid_client" };
    }
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      return { ok: false, reason: "invalid_input" };
    }
    const { otherUserId, accountId, reasonCode, details = "", messageIds, idempotencyKey } = input;
    if (!validId(otherUserId) || (accountId != null && !validId(accountId)) ||
        !Number.isInteger(reasonCode) || reasonCode < 0 || reasonCode > 5 ||
        typeof details !== "string" || details.length > 2000 ||
        !validId(idempotencyKey) || !Array.isArray(messageIds) ||
        messageIds.length < 1 || messageIds.length > 20 ||
        !messageIds.every(validId) ||
        new Set(messageIds.map(id => id.toLowerCase())).size !== messageIds.length) {
      return { ok: false, reason: "invalid_input" };
    }
    const userId = await currentAccount(client);
    if (!userId) return { ok: false, reason: "authentication_failed" };
    const peer = otherUserId.toLowerCase();
    if (userId === peer || (accountId && accountId.toLowerCase() !== userId)) {
      return { ok: false, reason: "wrong_account" };
    }

    // Canonicalize evidence order before both the authorized DM lookup and
    // the report RPC. A retry with the SAME selected IDs in another order
    // represents the same report, matching the server's sorted UUID array.
    const ids = messageIds.map(id => id.toLowerCase()).sort();
    let evidence;
    try {
      const result = await client.from("direct_messages")
        .select("id,sender_id,recipient_id")
        .in("id", ids);
      if (result?.error || !Array.isArray(result?.data)) {
        return { ok: false, reason: "evidence_unavailable" };
      }
      evidence = result.data;
    } catch {
      return { ok: false, reason: "evidence_unavailable" };
    }
    const allowedIds = new Set(ids);
    if (evidence.length !== ids.length ||
        new Set(evidence.map(row => typeof row?.id === "string" ? row.id.toLowerCase() : "")).size !== ids.length ||
        !evidence.every(row =>
          validId(row?.id) && validId(row?.sender_id) && validId(row?.recipient_id) &&
          allowedIds.has(row.id.toLowerCase()) &&
          ((row.sender_id.toLowerCase() === userId && row.recipient_id.toLowerCase() === peer) ||
           (row.sender_id.toLowerCase() === peer && row.recipient_id.toLowerCase() === userId)))) {
      return { ok: false, reason: "evidence_not_authorized" };
    }
    // The evidence query is asynchronous; a user can switch accounts while
    // it is pending. Re-check the current account BEFORE any report RPC.
    const beforeRpcAccount = await currentAccount(client);
    if (!beforeRpcAccount || beforeRpcAccount !== userId) {
      return { ok: false, reason: "wrong_account" };
    }
    try {
      const { data, error } = await client.rpc("xoxo_submit_conversation_report_beta", {
        p_other_user_id: peer,
        p_reason_code: reasonCode,
        p_details: details,
        p_message_ids: ids,
        p_idempotency_key: idempotencyKey.toLowerCase()
      });
      if (error || !validId(data)) return { ok: false, reason: "submission_failed" };
      // A successful remote write may finish after logout. Suppress the old
      // account's receipt in a new signed-in user's UI; the immutable key
      // allows the original member to recover that receipt when logged in.
      const afterRpcAccount = await currentAccount(client);
      if (!afterRpcAccount || afterRpcAccount !== userId) {
        return { ok: false, reason: "wrong_account" };
      }
      return { ok: true, reportId: data.toLowerCase() };
    } catch {
      return { ok: false, reason: "submission_failed" };
    }
  }
  return Object.freeze({ submit });
});
