"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const sandbox = { window: {}, document: {}, globalThis: {} };
vm.runInNewContext(fs.readFileSync("beta/xoxo-streaks.js", "utf8"), sandbox);
vm.runInContext(fs.readFileSync("beta/xoxo-streaks-chat-bridge.js", "utf8"), vm.createContext(sandbox));
const api = sandbox.window.XOXOStreaksBeta;
const bridgeApi = sandbox.window.XOXOStreaksChatBridgeBeta;

assert.ok(api, "BETA module should expose its API");
assert.ok(bridgeApi, "BETA host bridge should expose its API");
assert.deepEqual(Array.from(api.locales).sort(),
  ["en", "es", "pt-BR", "de", "nb", "pl", "fr", "cs", "sv", "it"].sort());
assert.equal(api.localeKey("es-MX"), "es");
assert.equal(api.localeKey("pt-BR"), "pt-BR");
assert.equal(api.localeKey("nb-NO"), "nb");
assert.equal(api.localeKey("no"), "nb");
assert.equal(api.localeKey("sv-SE"), "sv");
assert.equal(api.localeKey("it-IT"), "it");
assert.equal(api.localeKey("unknown"), "en");
assert.deepEqual(Array.from(api.milestones), [3, 7, 14, 30, 100]);
assert.equal(api.create(null), null);
assert.equal(bridgeApi.create({enabled:false}), null);
assert.equal(bridgeApi.create({enabled:true}), null);
const bridgeSource = fs.readFileSync("beta/xoxo-streaks-chat-bridge.js", "utf8");
const hostSource = fs.readFileSync("beta/xoxo-streaks-beta-host.js", "utf8");
assert.match(hostSource, /isConversationAllowed:\s*\(\)\s*=>/);
assert.match(hostSource, /conversationAllowed\(me, other\)/);
assert.match(bridgeSource, /isCurrent:\s*function/);
assert.match(bridgeSource, /options\.isConversationAllowed\(\) === true/,
  "late RPC responses must re-check live chat permission before rendering");
assert.match(bridgeSource, /latest\.account === ctx\.account/);
assert.match(bridgeSource, /latest\.other === ctx\.other/);
const uiSource = fs.readFileSync("beta/xoxo-streaks.js", "utf8");
assert.match(uiSource, /options\.isCurrent\(\)/);
assert.match(uiSource, /token !== requestToken/);
const sql = fs.readFileSync("beta/xoxo-streaks-schema.sql", "utf8");
assert.match(sql, /public\.direct_messages/);
assert.match(sql, /new\.sender_id/);
assert.match(sql, /new\.recipient_id/);
assert.match(sql, /xoxo_get_dm_streak/);
assert.match(sql, /public\.user_blocks/, "reader must check the verified production block relation");
assert.match(sql, /b\.blocker_id = v_me and b\.blocked_id = p_other_user/);
assert.match(sql, /b\.blocker_id = p_other_user and b\.blocked_id = v_me/);
assert.match(sql, /public\.direct_messages dm/);
assert.match(sql, /dm\.whisper_id is null/);
assert.match(sql, /coalesce\(dm\.media_view_mode, 'normal'\) = 'normal'/);
assert.match(sql, /media_view_mode/);
assert.match(sql, /whisper_id/);
assert.match(sql, /public\.dm_conversation_clears/);
assert.match(sql, /dc\.cleared_at at time zone 'UTC'/);
assert.match(sql, /where dc\.user_id = v_me\s+and dc\.other_user_id = p_other_user/);
assert.doesNotMatch(sql, /dc\.user_id = p_other_user and dc\.other_user_id = v_me/,
  "a user's local clear must not reset the other participant's streak view");
assert.match(sql, /v_clear_cutoff/);
assert.ok((sql.match(/v_clear_cutoff is null or d\.activity_date > v_clear_cutoff/g) || []).length >= 4,
  "all streak queries must exclude cleared activity");
console.log("PASS: locales, milestones, opt-in host bridge and SQL safety contract");


// Regression test: a response for a chat that has already changed must never paint.
(async function staleConversationResponseRegression() {
  function element() {
    return {
      attrs: {}, children: [], style: { cssText: "" }, textContent: "",
      setAttribute(k, v) { this.attrs[k] = v; },
      append(...items) { this.children.push(...items); },
      replaceChildren(...items) { this.children = items; }
    };
  }
  let resolveRpc;
  let currentPeer = "peer-a";
  const mount = element();
  const isolated = { window: {}, document: { createElement: element }, globalThis: {} };
  vm.runInNewContext(fs.readFileSync("beta/xoxo-streaks.js", "utf8"), isolated);
  const module = isolated.window.XOXOStreaksBeta;
  const instance = module.create({
    client: { rpc: () => new Promise(resolve => { resolveRpc = resolve; }) },
    accountId: "account-a",
    otherUserId: "peer-a",
    locale: "es",
    mount,
    isCurrent: () => currentPeer === "peer-a"
  });
  const pending = instance.refresh();
  currentPeer = "peer-b";
  resolveRpc({ data: [{ current_streak: 7, longest_streak: 9, next_milestone: 14 }], error: null });
  const rendered = await pending;
  assert.equal(rendered, false, "stale response should be discarded");
  assert.equal(mount.children.length, 0, "stale chat must not display the previous peer's streak");
  instance.destroy();
  assert.equal(mount.children.length, 0, "destroy must clear the mounted card");
  console.log("PASS: stale conversation response is discarded without rendering private state");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
