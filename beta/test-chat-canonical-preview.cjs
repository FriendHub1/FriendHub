"use strict";
/* Canonical opt-in chat preview: warning -> form -> evidence -> disabled write.
 * Guarantees that frontend inspection never invokes a live Supabase RPC.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const read = name => fs.readFileSync(path.join(__dirname, name), "utf8");
const user = "44444444-4444-4444-8444-444444444444";
const peer = "33333333-3333-4333-8333-333333333333";
const outsider = "55555555-5555-4555-8555-555555555555";
const msg = "22222222-2222-4222-8222-222222222221";
const otherMsg = "22222222-2222-4222-8222-222222222222";
const called = { auth: 0, reads: 0, rpc: 0, alerts: [] };
const client = {
  auth: { getUser: async () => { called.auth++; throw new Error("Auth must not run in preview"); } },
  from: () => { called.reads++; throw new Error("Never query live messages in preview"); },
  rpc: async () => { called.rpc++; throw new Error("Never write live reports in preview"); }
};
const window = {
  alert: message => called.alerts.push(message),
  crypto: { randomUUID: () => "11111111-1111-4111-8111-111111111111" },
  __xoxoCurrentDmMessages: [
    { id: msg, sender_id: peer, recipient_id: user, content: "suspicious request" },
    { id: otherMsg, sender_id: outsider, recipient_id: peer, content: "unrelated" }
  ]
};
const chat = { style: { display: "block" }, isConnected: true };
const events = [];
const document = {
  readyState: "loading",
  getElementById: id => id === "dmChat" ? chat : null,
  querySelector: () => null, // DOM stub: testing canonical flow, not toolbar layout
  addEventListener: (name, callback) => events.push([name, callback])
};
let form, picker, reminder;
window.XOXOReportFormBeta = { open: args => { form = args; return true; } };
window.XOXOEvidencePickerBeta = { open: args => { picker = args; return true; } };
window.XOXOSafetyReminderBeta = { show: args => { reminder = args; return true; } };
const context = vm.createContext({
  window, document, currentUser: { id: user }, currentDmUserId: peer,
  supabaseClient: client, getFriendHubLanguage: () => "es"
});
for (const name of [
  "stay-safe-browser-report-adapter.js", "stay-safe-browser-flow.js",
  "stay-safe-chat-preview-bridge.js"
]) vm.runInContext(read(name), context, { filename: name });

(async () => {
  const api = window.XOXOSafetyChatPreviewBeta;
  assert.equal(api.reportWritesEnabled(), false);
  assert.equal(events.length, 1);
  assert.deepEqual(Object.keys(api.translations).sort(), [
    "en", "es", "pt-BR", "fr", "pl", "de", "cs", "no", "sv", "it"
  ].sort());
  const conversation = api.visibleContext();
  assert.equal(conversation.messages.length, 1, "must exclude unrelated chat messages");
  assert.equal(api.openReport(), true, "preview should demonstrate report UI");
  assert.equal(form.locale, "es");
  form.onContinue({
    conversationId: conversation.conversationId,
    reasonCode: 1, details: "Reported threats"
  });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(picker.messages.length, 1);
  picker.onContinue({
    conversationId: conversation.conversationId, messageIds: [msg]
  });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(called.alerts.length, 1);
  assert.match(called.alerts[0], /No se envió ninguna denuncia/);
  assert.equal(called.auth, 0, "disabled preview must not authenticate");
  assert.equal(called.reads, 0, "disabled preview must not fetch evidence");
  assert.equal(called.rpc, 0, "disabled preview must never call report RPC");

  assert.equal(api.refresh(), true);
  assert.equal(typeof reminder.onReport, "function");
  reminder.onReport();
  assert.equal(form.conversationId, conversation.conversationId);
  assert.equal(called.rpc, 0);

  const direct = await api.submit({}, {}, [msg]);
  assert.equal(direct.reason, "beta_backend_disabled");
  assert.equal(called.rpc, 0);
  console.log("PASS: canonical workers.dev preview shows complete report flow with ZERO Supabase writes");
})().catch(error => { console.error(error); process.exitCode = 1; });