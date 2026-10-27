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
const whisperMsg = "22222222-2222-4222-8222-222222222223";
const onceMsg = "22222222-2222-4222-8222-222222222224";
const called = { auth: 0, reads: 0, rpc: 0, alerts: [] };
let authChange=null;
const client = {
  auth: {
    getUser: async () => { called.auth++; throw new Error("Auth must not run in preview"); },
    onAuthStateChange: cb => {
      authChange=cb;return {data:{subscription:{unsubscribe(){}}}};
    }
  },
  from: () => { called.reads++; throw new Error("Never query live messages in preview"); },
  rpc: async () => { called.rpc++; throw new Error("Never write live reports in preview"); }
};
const window = {
  alert: message => called.alerts.push(message),
  crypto: { randomUUID: () => "11111111-1111-4111-8111-111111111111" },
  __xoxoCurrentDmMessages: [
    { id: msg, sender_id: peer, recipient_id: user, content: "suspicious request" },
    { id: whisperMsg, sender_id: peer, recipient_id: user,
      content: "temporary", whisper_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
    { id: onceMsg, sender_id: peer, recipient_id: user,
      content: "one-time", media_view_mode: "once" },
    { id: otherMsg, sender_id: outsider, recipient_id: peer, content: "unrelated" }
  ]
};
const chat = { style: { display: "block" }, isConnected: true,
   querySelector:()=>null };
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
  window, document, location: { hostname: "feature-xoxo-streaks-beta.workers.dev" },
  currentUser: { id: user }, currentDmUserId: peer,
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
  // Even a populated SPA currentUser and DM cache cannot authorize the
  // preview before the real client announces INITIAL_SESSION.
  assert.equal(api.visibleContext(),null);
  assert.equal(api.openReport(),false);
  events[0][1](); // Simulate DOMContentLoaded and Auth listener installation.
  assert.equal(typeof authChange,"function");
  authChange("INITIAL_SESSION",null);
  assert.equal(api.openReport(),false);
  authChange("INITIAL_SESSION",{user:{id:user,is_anonymous:false}});
  const conversation = api.visibleContext();
  assert.equal(conversation.messages.length, 1,
    "must exclude unrelated chats, whispers and once-view evidence");
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
