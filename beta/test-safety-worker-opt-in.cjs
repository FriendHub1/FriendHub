"use strict";
// Static route guard: a safety BETA preview cannot accidentally be injected on
// xoxoavenue.com. The production HTML is unchanged by this feature branch.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const worker = fs.readFileSync(path.join(__dirname, "..", "worker.js"), "utf8");

function routeBlock(param, followingAnchor) {
  const query = 'url.searchParams.get("' + param + '") === "1"';
  const start = worker.indexOf(query);
  assert.ok(start > 0, "Expected opt-in route for " + param);
  const end = worker.indexOf(followingAnchor, start);
  assert.ok(end > start, "Could not isolate opt-in route " + param);
  return worker.slice(Math.max(0, start - 120), end);
}

const chat = routeBlock("xoxo_safety_chat_beta",
  "// Opt-in, branch-only preview of conversation reports");
const admin = routeBlock("xoxo_safety_admin_beta",
  "const xoxoShareLanguage =");
for (const [name, block] of [["chat", chat], ["admin", admin]]) {
  assert.match(block, /url\.hostname\.endsWith\("\.workers\.dev"\)/,
    name + " must only be available on workers.dev");
  assert.match(block, /request\.method === "GET"/,
    name + " must only respond to a GET preview request");
  assert.match(block, /Cache-Control",\s*"no-store"/,
    name + " must prevent response caching");
}
const dependencies = [
  "stay-safe-sweetheart.js", "stay-safe-report-form.js",
  "stay-safe-evidence-picker.js", "stay-safe-browser-report-adapter.js",
  "stay-safe-browser-flow.js", "stay-safe-chat-preview-bridge.js"
];
let position = 0;
for (const name of dependencies) {
  const next = chat.indexOf('<script src="/beta/' + name + '" defer></script>', position);
  assert.ok(next >= position, "Missing or out-of-order browser module: " + name);
  position = next + 1;
}
for (const name of ["admin-report-queue.js", "admin-report-panel-bridge.js"]) {
  assert.match(admin, new RegExp(name.replace(/\./g, "\\.")),
    "Must reuse one admin moderation integration: " + name);
}
assert.doesNotMatch(chat, /<script src="\/beta\/stay-safe-index-hooks\.js"/,
  "Do not inject a second competing chat host");
assert.doesNotMatch(admin, /<script src="\/beta\/stay-safe-admin-reports-bridge\.js"/,
  "Do not inject a second competing admin panel");
console.log("PASS: worker confines safety previews to workers.dev and loads a single canonical flow");
