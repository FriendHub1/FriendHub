"use strict";
// Preview-only safeguards: no live writes, and all 10 site languages.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const file = fs.readFileSync(path.join(__dirname, "stay-safe-chat-preview-bridge.js"), "utf8");
const root = {};
let docEvents = 0;
const doc = { readyState: "loading", addEventListener: () => { docEvents++; } };
vm.runInNewContext(file, { window: root, document: doc }, { filename: "stay-safe-chat-preview-bridge.js" });
const api = root.XOXOSafetyChatPreviewBeta;
assert.ok(api, "BETA preview API should be exported");
assert.equal(api.reportWritesEnabled(), false, "No production Supabase writes in UI-only preview");

const all = ["en", "es", "pt-BR", "fr", "pl", "de", "cs", "no", "sv", "it"];
assert.equal(Object.keys(api.translations).sort().join(","), all.sort().join(","),
  "All ten XOXO Avenue languages must be supported");
for (const locale of all) {
  const localeCopy = api.translations[locale];
  for (const key of ["button", "success", "failure"]) {
    assert.ok(typeof localeCopy[key] === "string" && localeCopy[key].trim().length > 0,
      "Missing " + locale + ":" + key);
  }
}
(async () => {
  let authCalls = 0, rpcCalls = 0;
  const client = {
    auth: { getUser: async () => { authCalls++; return {}; } },
    from: () => { throw Error("Must never read evidence in disabled preview"); },
    rpc: async () => { rpcCalls++; return { data: "fake" }; }
  };
  const res = await api.submit({client}, {reasonCode:1,details:"Report"}, []);
  assert.equal(res.ok, false);
  assert.equal(res.reason, "beta_backend_disabled");
  assert.equal(authCalls, 0);
  assert.equal(rpcCalls, 0);
  assert.equal(docEvents, 1, "Only the DOM-ready installation should be scheduled");
  console.log("PASS: opt-in preview has 10 languages and cannot submit to production Supabase");
})().catch(error => { console.error(error); process.exitCode = 1; });
