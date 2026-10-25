"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const expected = ["en","es","pt-BR","de","no","pl","fr","cs","sv","it"].sort();
const browser = { window: {} };
for (const file of [
  "stay-safe-sweetheart.js",
  "stay-safe-report-form.js",
  "stay-safe-evidence-picker.js"
]) {
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, file), "utf8"), browser, {filename:file});
}
const notice = browser.window.XOXOSafetyReminderBeta;
const form = browser.window.XOXOReportFormBeta;
const picker = browser.window.XOXOEvidencePickerBeta;
const groups = {
  notice: notice.copy,
  noticeActions: notice.actions,
  form: form.translations,
  picker: picker.translations
};
for (const [part, translations] of Object.entries(groups)) {
  const available = Object.keys(translations).sort();
  assert.equal(available.join(","), expected.join(","), part + " must contain the site's ten languages");
  for (const language of expected) {
    for (const [field, value] of Object.entries(translations[language])) {
      if (field === "reasons") continue;
      assert.equal(typeof value, "string", part + "/" + language + "/" + field + " must be text");
      assert.ok(value.trim().length >= 2, part + "/" + language + "/" + field + " must not be empty");
    }
  }
}
for (const language of expected) {
  const reasons = form.translations[language].reasons;
  assert.ok(Array.isArray(reasons), "reasons array required for " + language);
  assert.equal(reasons.length, 6, "exactly 6 reporting reasons in " + language);
  assert.equal(new Set(reasons).size, 6, "reporting reasons must be distinct in " + language);
  assert.ok(reasons.every(s => typeof s === "string" && s.trim().length > 2));
}
console.log("PASS: Stay Safe BETA all 10 languages, notice/actions/form/picker and 6 reasons per language");
