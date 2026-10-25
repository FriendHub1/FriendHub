"use strict";
// Pass a Supabase client initialized with the authenticated user's JWT.
// Never use the service-role client for this check.
async function verifyVisibleMessages(client, userId, peerId, messageIds) {
  if (!client || !userId || !peerId || userId === peerId ||
      !Array.isArray(messageIds) || messageIds.length < 1 ||
      messageIds.length > 20 || new Set(messageIds).size !== messageIds.length) {
    return { ok: false, reason: "invalid_input" };
  }
  const { data, error } = await client.from("direct_messages")
    .select("id,sender_id,recipient_id")
    .in("id", messageIds);
  if (error || !Array.isArray(data) || data.length !== messageIds.length) {
    return { ok: false, reason: "not_visible" };
  }
  const ids = new Set(messageIds);
  const allowed = data.every(m =>
    ids.has(m.id) &&
    ((m.sender_id === userId && m.recipient_id === peerId) ||
     (m.sender_id === peerId && m.recipient_id === userId)));
  return { ok: allowed, reason: allowed ? null : "wrong_conversation" };
}
module.exports = { verifyVisibleMessages };
