"use strict";
// BETA regression suite. Runs with Node mocks only; no live Supabase calls.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { create, localeFor } = require("./stay-safe-browser-bridge.js");

const SELF = "44444444-4444-4444-8444-444444444444";
const OTHER = "33333333-3333-4333-8333-333333333333";
const OUTSIDER = "55555555-5555-4555-8555-555555555555";
const MSG = "22222222-2222-4222-8222-222222222221";
const MSG2 = "22222222-2222-4222-8222-222222222222";
const KEY = "11111111-1111-4111-8111-111111111111";
const REPORT = "99999999-9999-4999-8999-999999999999";
const CONVERSATION = "test-dm-self-other";

function clientMock({
  user = SELF,
  rows = [{ id: MSG, sender_id: OTHER, recipient_id: SELF }],
  rpcData = REPORT,
  rpcError = null
} = {}) {
  const events = [];
  const client = {
    auth: { getUser: async () => {
      events.push("auth");
      return { data: { user: user ? { id: user } : null }, error: null };
    }},
    from: table => {
      assert.equal(table, "direct_messages");
      return {
        select: columns => {
          assert.equal(columns, "id,sender_id,recipient_id");
          return {
            in: async (key, ids) => {
              events.push("evidence");
              assert.equal(key, "id");
              assert.ok(Array.isArray(ids));
              return { data: rows, error: null };
            }
          };
        }
      };
    },
    rpc: async (name, args) => {
      events.push("rpc");
      assert.equal(name, "xoxo_submit_conversation_report_beta");
      assert.equal(args.p_other_user_id, OTHER);
      assert.ok(Number.isInteger(args.p_reason_code));
      assert.ok(Array.isArray(args.p_message_ids));
      assert.ok(args.p_idempotency_key);
      return { data: rpcData, error: rpcError };
    }
  };
  return { client, events };
}
function bridge(client, options = {}) {
  return create({
    getClient: () => client,
    getVisibleMessages: async () => [],
    onResult: () => {},
    generateId: () => KEY,
    ...options
  });
}
function input(overrides = {}) {
  return {
    accountId: SELF, otherUserId: OTHER, reasonCode: 1, details: "Threat",
    messageIds: [MSG], idempotencyKey: KEY, ...overrides
  };
}
function loadUi(file, globalName) {
  const context = { window: {} };
  const source = fs.readFileSync(path.join(__dirname, file), "utf8");
  vm.runInNewContext(source, context, { filename: file, timeout: 1000 });
  return context.window[globalName];
}
function verifyTenLanguages() {
  const expected = ["en", "es", "pt-BR", "de", "no", "pl", "fr", "cs", "sv", "it"].sort();
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const picker = html.match(/<select id="languageSelect"[\s\S]*?<\/select>/);
  assert.ok(picker, "Live language selector must be present in index.html");
  const websiteLocales = [...picker[0].matchAll(/<option value="([^"]+)"/g)]
    .map(match => match[1]).sort();
  // The website uses the BCP-47 'nb' key for Norwegian Bokmål; the
  // standalone safety dictionaries canonically store its copy under 'no'.
  // Compare normalized locales without demanding a site-language rename.
  assert.deepEqual(websiteLocales,
    ["en", "es", "pt-BR", "de", "nb", "pl", "fr", "cs", "sv", "it"].sort(),
    "The public site's actual ten language options must remain unchanged");
  assert.deepEqual(websiteLocales.map(localeFor).sort(), expected,
    "Safety BETA must support every website locale after alias normalization");
  const reminder = loadUi("stay-safe-sweetheart.js", "XOXOSafetyReminderBeta");
  const form = loadUi("stay-safe-report-form.js", "XOXOReportFormBeta");
  const evidence = loadUi("stay-safe-evidence-picker.js", "XOXOEvidencePickerBeta");
  for (const locale of expected) {
    assert.ok(reminder.copy[locale], "Missing reminder copy for " + locale);
    assert.ok(reminder.actions[locale], "Missing reminder actions for " + locale);
    assert.ok(form.translations[locale], "Missing form for " + locale);
    assert.ok(evidence.translations[locale], "Missing evidence picker for " + locale);
    assert.equal(form.translations[locale].reasons.length, 6);
    assert.ok(form.translations[locale].reasons.every(x => typeof x === "string" && x.length));
    assert.ok(evidence.translations[locale].continue, "Missing submission CTA in " + locale);
  }
  assert.equal(localeFor("pt-br"), "pt-BR");
  assert.equal(localeFor("nb-NO"), "no");
  assert.equal(localeFor("sv-SE"), "sv");
  assert.equal(localeFor("it-IT"), "it");
  return expected.length;
}
(async () => {
  const languages = verifyTenLanguages();

  const good = clientMock();
  assert.deepEqual(await bridge(good.client).submit(input()), { ok: true, reportId: REPORT });
  assert.deepEqual(good.events, ["auth", "evidence", "rpc"]);

  const invalid = clientMock();
  assert.equal((await bridge(invalid.client).submit(input({ messageIds: [] }))).reason, "invalid_input");
  assert.equal((await bridge(invalid.client).submit(input({ messageIds: [MSG, MSG] }))).reason, "invalid_input");
  assert.equal((await bridge(invalid.client).submit(input({ reasonCode: 6 }))).reason, "invalid_input");
  assert.equal((await bridge(invalid.client).submit(input({ messageIds: [MSG, MSG2], details: "x".repeat(2001) }))).reason, "invalid_input");
  assert.equal(invalid.events.length, 0);

  const loggedOut = clientMock({ user: null });
  assert.equal((await bridge(loggedOut.client).submit(input())).reason, "authentication_failed");
  assert.deepEqual(loggedOut.events, ["auth"]);
  const wrongUser = clientMock({ user: OUTSIDER });
  assert.equal((await bridge(wrongUser.client).submit(input())).reason, "authentication_failed");
  assert.deepEqual(wrongUser.events, ["auth"]);

  const missing = clientMock({ rows: [] });
  assert.equal((await bridge(missing.client).submit(input())).reason, "evidence_not_authorized");
  assert.deepEqual(missing.events, ["auth", "evidence"]);
  const cross = clientMock({ rows: [{ id: MSG, sender_id: OUTSIDER, recipient_id: SELF }] });
  assert.equal((await bridge(cross.client).submit(input())).reason, "evidence_not_authorized");
  assert.deepEqual(cross.events, ["auth", "evidence"]);
  const extra = clientMock({ rows: [{ id: MSG, sender_id: OTHER, recipient_id: SELF }, { id: MSG2, sender_id: OTHER, recipient_id: SELF }] });
  assert.equal((await bridge(extra.client).submit(input())).reason, "evidence_not_authorized");
  assert.deepEqual(extra.events, ["auth", "evidence"]);

  const serverFailure = clientMock({ rpcData: null, rpcError: { message: "not deployed" } });
  assert.equal((await bridge(serverFailure.client).submit(input())).reason, "submission_failed");
  assert.deepEqual(serverFailure.events, ["auth", "evidence", "rpc"]);

  let formContinue, pickerContinue, shownMessages, formLocale;
  const outcomes = [];
  const ui = {
    form: { open: ({ onContinue, locale }) => {
      formContinue = onContinue;
      formLocale = locale;
      return true;
    }},
    evidence: { open: ({ onContinue, messages }) => {
      pickerContinue = onContinue;
      shownMessages = messages;
      return true;
    }},
    reminder: { show: () => true }
  };
  const uiClient = clientMock();
  const flow = bridge(uiClient.client, {
    ui,
    onResult: result => outcomes.push(result),
    getVisibleMessages: async () => [
      { id: MSG, sender_id: OTHER, recipient_id: SELF, text: "Evidence #1" },
      { id: MSG2, sender_id: OUTSIDER, recipient_id: SELF, text: "UNAUTHORIZED" },
      { id: MSG, sender_id: OTHER, recipient_id: SELF, text: "Duplicate" }
    ]
  });
  assert.deepEqual(await flow.startReport({
    conversationId: CONVERSATION, accountId: SELF, otherUserId: OTHER, locale: "sv"
  }), { ok: true, opened: true });
  assert.equal(formLocale, "sv");
  await formContinue({ conversationId: CONVERSATION, reasonCode: 1, details: "Threat" });
  assert.deepEqual(shownMessages, [{ id: MSG, text: "Evidence #1" }]);
  await pickerContinue({ conversationId: CONVERSATION, messageIds: [MSG] });
  assert.equal(outcomes.length, 1);
  assert.deepEqual(outcomes[0], { ok: true, reportId: REPORT });
  assert.deepEqual(uiClient.events, ["auth", "auth", "evidence", "rpc"]);

  const noMessages = [];
  const noMessageBridge = bridge(uiClient.client, {
    ui,
    onResult: result => noMessages.push(result),
    getVisibleMessages: async () => [
      { id: MSG, sender_id: OTHER, recipient_id: OUTSIDER, text: "not this conversation" }
    ]
  });
  await noMessageBridge.startReport({
    conversationId: CONVERSATION, accountId: SELF, otherUserId: OTHER, locale: "it"
  });
  await formContinue({ conversationId: CONVERSATION, reasonCode: 0, details: "" });
  assert.equal(noMessages[0].reason, "no_evidence");

  console.log("PASS: 10 language parity checks + authenticated browser BETA report regression cases");
})().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
