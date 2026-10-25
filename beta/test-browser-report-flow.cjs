"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const adapter = require("./stay-safe-browser-report-adapter.js");

const user = "44444444-4444-4444-8444-444444444444";
const peer = "33333333-3333-4333-8333-333333333333";
const outsider = "55555555-5555-4555-8555-555555555555";
const id1 = "22222222-2222-4222-8222-222222222221";
const id2 = "22222222-2222-4222-8222-222222222222";
const key = "11111111-1111-4111-8111-111111111111";
const reportId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const input = { accountId: user, otherUserId: peer, reasonCode: 1,
  details: "Threats", messageIds: [id1], idempotencyKey: key };

function clientWith({ rows = [{ id: id1, sender_id: peer, recipient_id: user }],
                      authId = user, rpcData = reportId, rpcError = null } = {}) {
  const calls = [];
  const client = {
    auth: { getUser: async () => {
      calls.push("auth");
      return { data: { user: authId ? { id: authId } : null }, error: null };
    } },
    from: table => {
      assert.equal(table, "direct_messages");
      return { select: fields => {
        assert.equal(fields, "id,sender_id,recipient_id");
        return { in: async (field, ids) => {
          assert.equal(field, "id");
          calls.push("evidence");
          return { data: rows.filter(row => ids.includes(row.id)), error: null };
        } };
      } };
    },
    rpc: async (name, params) => {
      calls.push("rpc");
      assert.equal(name, "xoxo_submit_conversation_report_beta");
      assert.equal(params.p_other_user_id, peer);
      assert.equal(params.p_reason_code, 1);
      assert.equal(params.p_idempotency_key, key);
      return { data: rpcData, error: rpcError };
    }
  };
  return { client, calls };
}

async function testAdapter() {
  let test = clientWith();
  assert.deepEqual(await adapter.submit(test.client, input), { ok: true, reportId });
  assert.deepEqual(test.calls, ["auth", "evidence", "rpc"]);

  test = clientWith({ authId: null });
  assert.equal((await adapter.submit(test.client, input)).reason, "authentication_failed");
  assert.deepEqual(test.calls, ["auth"]);

  test = clientWith({ authId: outsider });
  assert.equal((await adapter.submit(test.client, input)).reason, "wrong_account");
  assert.deepEqual(test.calls, ["auth"]);

  test = clientWith({ rows: [] });
  assert.equal((await adapter.submit(test.client, input)).reason, "evidence_not_authorized");
  assert.deepEqual(test.calls, ["auth", "evidence"]);

  test = clientWith({ rows: [{ id: id1, sender_id: outsider, recipient_id: peer }] });
  assert.equal((await adapter.submit(test.client, input)).reason, "evidence_not_authorized");
  assert.deepEqual(test.calls, ["auth", "evidence"]);

  test = clientWith({ rpcError: { message: "not deployed" }, rpcData: null });
  assert.equal((await adapter.submit(test.client, input)).reason, "submission_failed");
  assert.deepEqual(test.calls, ["auth", "evidence", "rpc"]);

  test = clientWith();
  assert.equal((await adapter.submit(test.client, { ...input, messageIds: [id1, id1] })).reason, "invalid_input");
  assert.deepEqual(test.calls, []);

  test = clientWith();
  assert.equal((await adapter.submit(test.client, { ...input, reasonCode: 7 })).reason, "invalid_input");
  assert.deepEqual(test.calls, []);
}

function browserHarness({ enabled = true, rows, submit, getMessages: overrideMessages, isContextActive } = {}) {
  const status = [];
  const ui = { form: null, picker: null, reminder: null, calls: 0 };
  const root = {
    crypto: { randomUUID: () => key },
    XOXOReportSubmitBrowserBeta: { submit: submit || adapter.submit },
    XOXOReportFormBeta: { open: args => { ui.form = args; return true; } },
    XOXOEvidencePickerBeta: { open: args => { ui.picker = args; return true; } },
    XOXOSafetyReminderBeta: { show: args => { ui.reminder = args; return true; } }
  };
  const source = fs.readFileSync(path.join(__dirname, "stay-safe-browser-flow.js"), "utf8");
  const ctx = vm.createContext({ window: root });
  vm.runInContext(source, ctx, { filename: "stay-safe-browser-flow.js" });
  const { client, calls } = clientWith({ rows: rows || [{ id: id1, sender_id: peer, recipient_id: user }] });
  const flow = root.XOXOSafetyFlowBeta.create({
    client, accountId: user, otherUserId: peer, conversationId: "conversation-1",
    locale: "es", enabled, isContextActive,
    getMessages: overrideMessages || (() => [
      { id: id1, sender_id: peer, recipient_id: user, content: "Please review" },
      { id: id2, sender_id: user, recipient_id: peer, text: "A response" },
      { id: "99999999-9999-4999-8999-999999999999", sender_id: outsider, recipient_id: peer, text: "Different chat" }
    ]), onStatus: result => status.push(result)
  });
  return { flow, ui, status, calls };
}
const flush = () => new Promise(resolve => setImmediate(resolve));

async function testFlow() {
  const h = browserHarness();
  assert.equal(h.flow.showReminder(), true);
  assert.equal(h.ui.reminder.conversationId, "conversation-1");
  h.ui.reminder.onReport();
  assert.equal(h.ui.form.locale, "es");
  h.ui.form.onContinue({ conversationId: "conversation-1", reasonCode: 1, details: "Threats" });
  await flush();
  assert.equal(h.ui.picker.messages.length, 2, "must exclude messages from other chats");
  h.ui.picker.onContinue({ conversationId: "conversation-1", messageIds: [id1] });
  await flush();
  assert.equal(h.status.length, 1);
  assert.equal(h.status[0].ok, true);
  assert.equal(h.status[0].reportId, reportId);

  const disabled = browserHarness({ enabled: false });
  assert.equal(disabled.flow.showReminder(), true);
  assert.equal(typeof disabled.ui.reminder.onReport, "undefined",
    "disabled feature must not show a report button");
  assert.equal(disabled.flow.openReport(), false,
    "disabled feature must not open an unsendable form");
  assert.equal(disabled.ui.form, null);
  assert.equal(disabled.status[0].reason, "disabled");
  assert.deepEqual(disabled.calls, [], "feature flag must prevent auth and RPC calls");

  const rejected = browserHarness();
  rejected.flow.openReport();
  rejected.ui.form.onContinue({ conversationId: "conversation-1", reasonCode: 1, details: "Threats" });
  await flush();
  rejected.ui.picker.onContinue({ conversationId: "conversation-1", messageIds: [outsider] });
  await flush();
  assert.equal(rejected.status[0].reason, "invalid_evidence");
  assert.deepEqual(rejected.calls, []);

  let active = true;
  const stale = browserHarness({
    getMessages: () => active ? [{ id: id1, sender_id: peer, recipient_id: user,
      content: "Message in currently open chat" }] : [],
    isContextActive: () => active
  });
  stale.flow.openReport();
  stale.ui.form.onContinue({ conversationId: "conversation-1", reasonCode: 1, details: "Threats" });
  await flush();
  assert.equal(stale.ui.picker.messages.length, 1);
  active = false; // user navigated away between picking and submission
  stale.ui.picker.onContinue({ conversationId: "conversation-1", messageIds: [id1] });
  await flush();
  assert.equal(stale.status[0].reason, "conversation_changed",
    "stale chat selection must fail before authenticated RPC");
  assert.deepEqual(stale.calls, [], "no account or evidence access after chat changes");

  let attempts = 0;
  const keys = [];
  const retry = browserHarness({ submit: async (client, args) => {
    keys.push(args.idempotencyKey);
    attempts += 1;
    return attempts === 1 ? { ok: false, reason: "submission_failed" } :
      { ok: true, reportId };
  } });
  for (let i = 0; i < 2; i++) {
    retry.flow.openReport();
    retry.ui.form.onContinue({ conversationId: "conversation-1", reasonCode: 1, details: "Threats" });
    await flush();
    retry.ui.picker.onContinue({ conversationId: "conversation-1", messageIds: [id1] });
    await flush();
  }
  assert.equal(retry.status[0].ok, false);
  assert.equal(retry.status[1].ok, true);
  assert.deepEqual(keys, [key, key], "identical failed submissions must reuse idempotency key");
}

(async () => {
  await testAdapter();
  await testFlow();
  console.log("PASS: browser adapter + BETA report flow (auth, RLS, evidence, disabled, retry)");
})().catch(error => { console.error(error); process.exitCode = 1; });
