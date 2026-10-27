const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync("beta/xoxo-streaks.js", "utf8");
const sandbox = { window: {}, document: {}, globalThis: {} };
vm.runInNewContext(source, sandbox);
const api = sandbox.window.XOXOStreaksBeta;

assert.ok(api, "BETA module should expose its API");
assert.deepEqual(Array.from(api.locales).sort(),
  ["en", "es", "pt-BR", "de", "nb", "pl", "fr", "cs", "sv", "it"].sort(),
  "all ten XOXO Avenue locales must be supported");
assert.equal(api.localeKey("es-MX"), "es");
assert.equal(api.localeKey("pt-BR"), "pt-BR");
assert.equal(api.localeKey("nb-NO"), "nb");
assert.equal(api.localeKey("no"), "nb");
assert.equal(api.localeKey("sv-SE"), "sv");
assert.equal(api.localeKey("it-IT"), "it");
assert.equal(api.localeKey("unknown"), "en");
assert.deepEqual(Array.from(api.milestones), [3, 7, 14, 30, 100]);
assert.equal(api.create(null), null);
assert.equal(api.create({ client: {}, accountId: "same", otherUserId: "same", mount: { replaceChildren() {} } }), null);
console.log("PASS: XOXO Streaks BETA locale, milestones and input-validation contract");
