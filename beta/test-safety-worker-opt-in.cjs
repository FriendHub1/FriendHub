"use strict";
// Static route guard: a safety BETA preview cannot accidentally be injected on
// xoxoavenue.com. The production HTML is unchanged by this feature branch.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const worker = fs.readFileSync(path.join(__dirname, "..", "worker.js"), "utf8");

const start = worker.indexOf("// Stay Safe, Sweetheart! — production integration.");
const end = worker.indexOf("const xoxoShareLanguageRaw =",start);
assert.ok(start>=0 && end>start,"combined preview route exists");
const route=worker.slice(start,end);
assert.match(route, /url\.hostname\.endsWith\("\.workers\.dev"\)/);
assert.match(route, /request\.method === "GET"/);
assert.match(route, /Cache-Control",\s*"no-store"/);
for(const param of ["xoxo_safety_chat_beta","xoxo_safety_admin_beta"])
  assert.ok(route.includes('url.searchParams.get("'+param+'") === "1"'));
const dependencies = [
  "stay-safe-sweetheart.js", "stay-safe-report-form.js",
  "stay-safe-evidence-picker.js", "stay-safe-browser-report-adapter.js",
  "stay-safe-browser-flow.js", "stay-safe-chat-preview-bridge.js"
];
let position = 0;
for (const name of dependencies) {
  const next = route.indexOf('<script src="/beta/' + name + '" defer></script>', position);
  assert.ok(next >= position, "Missing or out-of-order browser module: " + name);
  position = next + 1;
}
for (const name of ["admin-report-queue.js", "admin-report-panel-bridge.js"]) {
  assert.match(route, new RegExp(name.replace(/\./g, "\\.")),
    "Must reuse one admin moderation integration: " + name);
}
assert.doesNotMatch(route, /<script src="\/beta\/stay-safe-index-hooks\.js"/,
  "Do not inject a second competing chat host");
assert.doesNotMatch(route, /<script src="\/beta\/stay-safe-admin-reports-bridge\.js"/,
  "Do not inject a second competing admin panel");
console.log("PASS: worker confines safety previews to workers.dev and loads a single canonical flow");
