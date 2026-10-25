"use strict";
// Pass a Supabase client initialized with the authenticated user's JWT.
// Never use the service-role client for this check.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
async function verifyVisibleMessages(client, userId, peerId, messageIds) {
  if (!client?.from || !UUID.test(userId || "") || !UUID.test(peerId || "") ||
      userId.toLowerCase() === peerId.toLowerCase() ||
      !Array.isArray(messageIds) || messageIds.length < 1 ||
      messageIds.length > 20 || messageIds.some(id => !UUID.test(id)) ||
      new Set(messageIds.map(id => id.toLowerCase())).size !== messageIds.length) {
    return { ok: false, reason: "invalid_input" };
  }
  let data, error;
  try {
    ({ data, error } = await client.from("direct_messages")
      .select("id,sender_id,recipient_id")
      .in("id", messageIds));
  } catch {
    return { ok: false, reason: "query_failed" };
  }
  if (error || !Array.isArray(data) || data.length !== messageIds.length) {
    return { ok: false, reason: "not_visible" };
  }
  if (data.some(m => !m || !UUID.test(m.id || "") || !UUID.test(m.sender_id || "") || !UUID.test(m.recipient_id || ""))) {
    return { ok: false, reason: "invalid_result" };
  }
  const ids = new Set(messageIds.map(id => id.toLowerCase()));
  const returnedIds = new Set(data.map(m => String(m.id).toLowerCase()));
  if (returnedIds.size !== messageIds.length) return { ok: false, reason: "duplicate_result" };
  const self = userId.toLowerCase(), peer = peerId.toLowerCase();
  const allowed = data.every(m =>
    ids.has(String(m.id).toLowerCase()) &&
    ((String(m.sender_id).toLowerCase() === self && String(m.recipient_id).toLowerCase() === peer) ||
     (String(m.sender_id).toLowerCase() === peer && String(m.recipient_id).toLowerCase() === self)));
  return { ok: allowed, reason: allowed ? null : "wrong_conversation" };
}
module.exports = { verifyVisibleMessages };
