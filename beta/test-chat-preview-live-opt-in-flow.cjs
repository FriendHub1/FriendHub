"use strict";
// Full synthetic UI -> evidence -> authenticated RPC test for the new opt-in.
// All data and responses are fake; NEVER contacts the live Supabase project.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const user = "44444444-4444-4444-8444-444444444444";
const peer = "33333333-3333-4333-8333-333333333333";
const messageId = "22222222-2222-4222-8222-222222222221";
const reportId = "11111111-1111-4111-8111-111111111111";
const idempotencyKey = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const events = [], rpcCalls = [], alerts = [];
let authChange, form, picker;
let signedIn = true;
const client = {
  auth: {
    onAuthStateChange(callback) { authChange = callback; return { data: { subscription: {} } }; },
    async getUser() { return signedIn ? { data: { user: { id: user, is_anonymous: false } } } :
      { data: { user: null } }; }
  },
  from(table) {
    assert.equal(table, "direct_messages");
    return { select(fields) {
      assert.equal(fields, "id,sender_id,recipient_id");
      return { async in(column, ids) {
        assert.equal(column, "id");
        assert.deepEqual(Array.from(ids), [messageId]);
        return { data: [{ id: messageId, sender_id: peer, recipient_id: user }], error: null };
      } };
    } };
  },
  async rpc(name, args) {
    rpcCalls.push([name, args]);
    assert.equal(name, "xoxo_submit_conversation_report_beta");
    return { data: reportId, error: null };
  }
};
const window = {
  location: { hostname: "friendhub.example.workers.dev",
    search: "?xoxo_safety_chat_beta=1&xoxo_safety_report_write_beta=1" },
  alert: text => alerts.push(text),
  crypto: { randomUUID: () => idempotencyKey },
  __xoxoCurrentDmMessages: [{ id: messageId, sender_id: peer,
    recipient_id: user, content: "Synthetic evidence" }],
  XOXOReportFormBeta: { open(args) { form = args; return true; } },
  XOXOEvidencePickerBeta: { open(args) { picker = args; return true; } },
  XOXOSafetyReminderBeta: { show: () => true }
};
const chat = { style: { display: "block" }, isConnected: true, querySelector: () => null };
const document = {
  readyState: "loading",
  addEventListener: (name, callback) => events.push([name, callback]),
  getElementById: id => id === "dmChat" ? chat : null,
  querySelector: () => null
};
const context = vm.createContext({ window, document, URLSearchParams,
  currentUser: { id: user }, currentDmUserId: peer,
  supabaseClient: client, getFriendHubLanguage: () => "es" });
for (const name of ["stay-safe-browser-report-adapter.js",
  "stay-safe-browser-flow.js", "stay-safe-chat-preview-bridge.js"]) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, name), "utf8"), context,
    { filename: name });
}
const tick = () => new Promise(resolve => setImmediate(resolve));
(async () => {
  const api = window.XOXOSafetyChatPreviewBeta;
  assert.equal(api.reportWritesEnabled(), true);
  assert.equal(api.openReport(), false, "a stale SPA session cannot authorize reporting");
  events[0][1]();
  authChange("INITIAL_SESSION", { user: { id: user, is_anonymous: false } });
  assert.equal(api.openReport(), true);
  const conversationId = api.visibleContext().conversationId;
  form.onContinue({ conversationId, reasonCode: 1, details: "Synthetic threat" });
  await tick();
  assert.equal(picker.messages.length, 1);
  picker.onContinue({ conversationId, messageIds: [messageId] });
  await tick(); await tick();
  assert.equal(rpcCalls.length, 1, "a successful selection sends exactly one RPC");
  assert.equal(rpcCalls[0][1].p_other_user_id, peer);
  assert.equal(rpcCalls[0][1].p_reason_code, 1);
  assert.equal(rpcCalls[0][1].p_details, "Synthetic threat");
  assert.deepEqual(Array.from(rpcCalls[0][1].p_message_ids), [messageId]);
  assert.equal(rpcCalls[0][1].p_idempotency_key, idempotencyKey);
  assert.equal(alerts.length, 1);
  assert.match(alerts[0], /Denuncia enviada/);
  assert.equal((await api.submit()).reason, "beta_backend_disabled",
    "direct legacy/test API cannot bypass the validated UI flow");
  assert.equal(rpcCalls.length, 1);
  signedIn = false;
  authChange("SIGNED_OUT", null);
  picker.onContinue({ conversationId, messageIds: [messageId] });
  await tick();
  assert.equal(rpcCalls.length, 1, "stale controls cannot write after sign-out");
  console.log("PASS: explicit workers.dev BETA opt-in completes one signed synthetic report and blocks stale sessions");
})().catch(error => { console.error(error); process.exitCode = 1; });
