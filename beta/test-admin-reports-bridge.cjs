"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const user = "44444444-4444-4444-8444-444444444444";
const peer = "33333333-3333-4333-8333-333333333333";
const reportId = "11111111-1111-4111-8111-111111111111";
const messageId = "22222222-2222-4222-8222-222222222221";

function loadBridge() {
  const root = {
    confirm: () => true,
    XOXOReportFormBeta: { translations: {
      en: { reasons: ["Scam", "Threats", "Harassment", "Fake", "Intimate photo threats", "Other"] }
    } }
  };
  const source = fs.readFileSync(path.join(__dirname, "stay-safe-admin-reports-bridge.js"), "utf8");
  vm.runInNewContext(source, { window: root }, { filename: "stay-safe-admin-reports-bridge.js" });
  return { root, api: root.XOXOAdminConversationReportsBeta };
}

// A small DOM stub; validates that we append to the existing reports section
// without creating any duplicate DM content viewer or replacing its cards.
function fakeDocument() {
  const doc = { createElement: tag => new Element(tag, doc) };
  class Element {
    constructor(tag, ownerDocument) {
      this.tagName = tag.toUpperCase();
      this.ownerDocument = ownerDocument;
      this.children = [];
      this.dataset = {};
      this.className = "";
      this.textContent = "";
      this.events = {};
      this.isConnected = true;
      this.parent = null;
    }
    append(...children) {
      for (const child of children) { child.parent = this; this.children.push(child); }
    }
    remove() {
      if (this.parent) this.parent.children = this.parent.children.filter(x => x !== this);
      this.isConnected = false;
    }
    addEventListener(name, callback) { this.events[name] = callback; }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    querySelectorAll(selector) {
      const match = el => selector === "button" ? el.tagName === "BUTTON"
        : selector === "[data-xoxo-conversation-reports-beta]" ? Object.hasOwn(el.dataset, "xoxoConversationReportsBeta")
        : selector.startsWith(".") && el.className.split(" ").includes(selector.slice(1));
      const result = [];
      const visit = el => {
        for (const child of el.children) {
          if (match(child)) result.push(child);
          visit(child);
        }
      };
      visit(this);
      return result;
    }
  }
  return { doc, Element };
}

(async () => {
  const { root, api } = loadBridge();
  const languages = Object.keys(api.translations).sort();
  assert.equal(languages.join(","), ["en","es","pt-BR","de","no","pl","fr","cs","sv","it"].sort().join(","));
  const report = {
    id: reportId, reporter_id: user, reported_user_id: peer, reason_code: 1,
    details: "Please investigate", status: "pending", message_ids: [messageId],
    created_at: "2026-10-25T12:00:00Z"
  };
  const calls = [];
  let allow = false;
  const client = { rpc: async (name, args) => {
    calls.push([name, args]);
    if (!allow) return { data: null, error: { message: "PIN required" } };
    if (name === "xoxo_admin_list_conversation_reports_beta") return { data: [report], error: null };
    if (name === "xoxo_admin_update_conversation_report_beta")
      return { data: args.p_report_id === reportId && args.p_status === "reviewed", error: null };
    throw Error("Unrecognized RPC: " + name);
  } };
  const opened = [], errors = [];
  const { doc } = fakeDocument();
  const container = doc.createElement("div");
  container.id = "xmmReportsList";
  const existing = doc.createElement("article");
  existing.textContent = "Existing single-message report";
  container.append(existing);
  const bridge = api.create({
    client, locale: "en",
    onOpenConversation: users => opened.push(users),
    onUnlock: async () => { allow = true; return true; },
    onError: reason => errors.push(reason)
  });

  assert.equal((await bridge.listReports()).ok, false, "must fail closed before PIN");
  assert.equal(await bridge.attach(container), false);
  assert.equal(container.children[0], existing, "must preserve existing report cards");
  const unlock = container.querySelectorAll("button")[0];
  assert.ok(unlock, "offer existing PIN unlock");
  await unlock.events.click();
  assert.equal(container.children[0], existing, "must not delete existing report cards");

  const headings = container.querySelectorAll(".xmm-report-card");
  assert.equal(headings.length, 1, "one BETA report in existing list");
  const buttons = container.querySelectorAll("button");
  assert.equal(buttons.length, 4, "existing viewer opener and three status changes");
  await buttons[0].events.click();
  assert.equal(opened.length, 1);
  assert.equal(opened[0].user_1, user);
  assert.equal(opened[0].user_2, peer);
  assert.equal(Object.hasOwn(opened[0], "content"), false, "never pass message content");

  await buttons[1].events.click();
  assert.ok(calls.some(([name,args]) =>
    name === "xoxo_admin_update_conversation_report_beta" &&
    args.p_report_id === reportId && args.p_status === "reviewed"
  ), "update must use only the new beta status RPC");
  assert.equal(errors.length, 0);

  assert.equal((await bridge.setStatus(reportId, "not-a-status")).reason, "invalid_input");
  assert.equal((await bridge.setStatus("invalid", "reviewed")).reason, "invalid_input");
  assert.ok(!calls.some(([name]) => name === "xoxo_admin_read_dm_page_pin"),
    "bridge must never directly read private messages");
  console.log("PASS: PIN-gated BETA admin reports, existing list preserved, viewer reused, status RPC");
})().catch(error => { console.error(error); process.exitCode = 1; });
