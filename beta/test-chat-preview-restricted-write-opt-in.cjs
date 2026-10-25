"use strict";
// BETA browser switch is deliberately NOT a permission grant. It may enable
// the UI only at workers.dev; the RPC independently enforces the expiring
// Supabase account allowlist and checks every selected DM on the server.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname,
  "stay-safe-chat-preview-bridge.js"), "utf8");

function enabled(hostname, search) {
  const root = { location: { hostname, search } };
  const document = { readyState: "loading", addEventListener() {} };
  vm.runInNewContext(source, { window: root, document, URLSearchParams },
    { filename: "stay-safe-chat-preview-bridge.js" });
  return root.XOXOSafetyChatPreviewBeta.reportWritesEnabled();
}

const optIn = "?xoxo_safety_chat_beta=1&xoxo_safety_report_write_beta=1";
assert.equal(enabled("staging-friendhub.example.workers.dev", optIn), true);
assert.equal(enabled("friendhub.paredesarixon.workers.dev", optIn), true);
for (const host of ["xoxoavenue.com", "www.xoxoavenue.com",
  "workers.dev.attacker.example", "localhost", "workers.dev.example.com"]) {
  assert.equal(enabled(host, optIn), false,
    "Production or misleading hostname must be denied: " + host);
}
for (const query of ["", "?xoxo_safety_chat_beta=1",
  "?xoxo_safety_report_write_beta=1",
  "?xoxo_safety_chat_beta=0&xoxo_safety_report_write_beta=1",
  "?xoxo_safety_chat_beta=1&xoxo_safety_report_write_beta=0"]) {
  assert.equal(enabled("friendhub.paredesarixon.workers.dev", query), false,
    "Both explicit test opt-in flags are necessary");
}
assert.match(source, /enabled:REPORT_RPC_WRITES_ENABLED/);
assert.match(source, /previewOnly:!REPORT_RPC_WRITES_ENABLED/);
assert.match(source, /authSignedOut=true/);
console.log("PASS: restricted BETA report write opt-in rejects public domains and is off by default");
