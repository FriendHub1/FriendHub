"use strict";
/* XOXO Avenue — ensure all ten supported languages stay complete across
 * the safety warning, report form, evidence picker, admin bridge and browser flow.
 * Runs in Node without network, database writes, or DOM dependencies.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const locales = ["en", "es", "pt-BR", "fr", "pl", "de", "cs", "no", "sv", "it"];
const fields = {
  warning: ["title", "intro", "money", "privacy", "images", "links", "support", "ack"],
  actions: ["tips", "report", "meet", "threat"],
  form: ["title", "intro", "reason", "details", "placeholder", "submit", "cancel", "privacy"],
  picker: ["title", "help", "empty", "continue", "cancel", "none", "limit"],
  admin: ["title", "user", "peer", "reason", "evidence", "details", "none", "empty",
    "view", "loading", "locked", "unlock", "failed", "saveFailed", "status"],
  activeAdmin: ["title", "by", "target", "reason", "details", "empty", "evidence",
    "units", "view", "unlock", "saving", "saveFailed", "unavailable", "retryPin", "confirm"]
};
const window = { alert: () => {}, crypto: { randomUUID: () => "11111111-1111-4111-8111-111111111111" } };
function load(file) {
  const source = fs.readFileSync(path.join(__dirname, file), "utf8");
  vm.runInNewContext(source, { window }, { filename: file });
}
load("stay-safe-sweetheart.js");
load("stay-safe-report-form.js");
load("stay-safe-evidence-picker.js");
load("stay-safe-admin-reports-bridge.js");
const activeAdminRoot = { addEventListener: () => {} };
const activeAdminSource = fs.readFileSync(path.join(__dirname, "admin-report-panel-bridge.js"), "utf8");
vm.runInNewContext(activeAdminSource, {
  window: activeAdminRoot,
  document: { readyState: "loading" }
}, { filename: "admin-report-panel-bridge.js" });
const dictionaries = {
  warning: window.XOXOSafetyReminderBeta.copy,
  actions: window.XOXOSafetyReminderBeta.actions,
  form: window.XOXOReportFormBeta.translations,
  picker: window.XOXOEvidencePickerBeta.translations,
  admin: window.XOXOAdminConversationReportsBeta.translations,
  activeAdmin: activeAdminRoot.XOXOActiveAdminSafetyCopyBeta
};
for (const [section, dictionary] of Object.entries(dictionaries)) {
  assert.deepEqual(Object.keys(dictionary).sort(), [...locales].sort(),
    section + " must have exactly the 10 enabled language keys");
  for (const locale of locales) {
    const item = dictionary[locale];
    for (const field of fields[section]) {
      assert.ok(typeof item[field] === "string" && item[field].trim().length > 0,
        section + " " + locale + " is missing " + field);
    }
  }
}
for (const locale of locales) {
  assert.equal(dictionaries.form[locale].reasons.length, 6,
    locale + ": all six report reasons are mandatory");
  assert.equal(dictionaries.admin[locale].states.length, 4,
    locale + ": all four status labels are mandatory");
  for (const key of ["pending", "reviewed", "resolved", "dismissed"]) {
    assert.ok(dictionaries.activeAdmin[locale].statuses[key]?.trim().length,
      locale + ": active admin status missing " + key);
    assert.ok(dictionaries.activeAdmin[locale].actions[key]?.trim().length,
      locale + ": active admin action missing " + key);
  }
  assert.equal(dictionaries.activeAdmin[locale].reasons.length, 6,
    locale + ": active admin must translate all six report reasons");
  for (const value of [...dictionaries.form[locale].reasons, ...dictionaries.admin[locale].states]) {
    assert.ok(typeof value === "string" && value.trim().length > 0);
  }
}
const defaultUser = "44444444-4444-4444-8444-444444444444";
const defaultPeer = "33333333-3333-4333-8333-333333333333";
const seen = [];
window.XOXOReportFormBeta = { open: args => { seen.push(args.locale); return true; } };
load("stay-safe-browser-flow.js");
for (const locale of locales) {
  const flow = window.XOXOSafetyFlowBeta.create({
    accountId: defaultUser, otherUserId: defaultPeer, conversationId: "test-" + locale,
    getMessages: () => [], locale, enabled: true, client: {},
    onStatus: () => {}
  });
  assert.equal(flow.openReport(), true, locale + ": report form should be available in BETA");
}
assert.deepEqual(seen, locales, "the browser flow must pass the requested locale through");
console.log("PASS: 10 languages across the active admin preview, warning, report form, evidence and browser flow");
