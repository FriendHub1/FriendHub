"use strict";
/* Static route isolation guard for the workers.dev-only BETA preview.
 * It does not claim a Cloudflare deployment or database integration test.
 */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const worker=fs.readFileSync(path.join(__dirname,"..","worker.js"),"utf8");
const preview=fs.readFileSync(path.join(__dirname,"stay-safe-chat-preview-bridge.js"),"utf8");
const indexHooks=fs.readFileSync(path.join(__dirname,"stay-safe-index-hooks.js"),"utf8");

function section(before,after){
  const i=worker.indexOf(before),j=worker.indexOf(after,i+before.length);
  assert.ok(i>=0 && j>i,"Worker BETA section not found: "+before);
  return worker.slice(i,j);
}
const route=section('// Stay Safe, Sweetheart! — production integration.',
  'const xoxoShareLanguageRaw =');
assert.match(route,/url\.hostname\.endsWith\("\.workers\.dev"\)/,
  "the combined route must not inject scripts on the public production domain");
assert.match(route,/request\.method === "GET"/,
  "the route must not intercept POST or API traffic");
for(const flag of ["xoxo_safety_chat_beta","xoxo_safety_admin_beta"]){
  assert.ok(route.includes('url.searchParams.get("'+flag+'") === "1"'),
    flag+" must remain an explicit opt-in");
}
assert.match(route,/enableSafetyChat \|\| enableSafetyAdmin/);
assert.match(route,/headers\.set\("Cache-Control",\s*"no-store"\)/,
  "private preview pages must never be cached");
const scripts=[
  "/beta/stay-safe-sweetheart.js",
  "/beta/stay-safe-report-form.js",
  "/beta/stay-safe-evidence-picker.js",
  "/beta/stay-safe-browser-report-adapter.js",
  "/beta/stay-safe-browser-flow.js",
  "/beta/stay-safe-chat-preview-bridge.js"
];
let offset=-1;
for(const filename of scripts){
  const at=route.indexOf(filename);
  assert.ok(at>offset,"missing or out-of-order chat dependency: "+filename);
  offset=at;
}
assert.match(route,/\/beta\/admin-report-queue\.js/);
assert.match(route,/\/beta\/admin-report-panel-bridge\.js/);
assert.ok(route.indexOf("/beta/stay-safe-chat-preview-bridge.js")<
  route.indexOf("/beta/admin-report-queue.js"),"chat dependencies must precede admin dependencies");
assert.doesNotMatch(route,/stay-safe-admin-reports-bridge\.js/,
  "do not inject the retired/draft alternative admin report adapter");
assert.match(preview,/workers\\\.dev\$\/i\.test\(String\(window\.location\?\.hostname/,
  "report writes must be unavailable outside workers.dev");
assert.match(preview,/previewSearch\?\.get\("xoxo_safety_chat_beta"\)===\"1\"/,
  "report writes require the original BETA chat opt-in");
assert.match(preview,/previewSearch\?\.get\("xoxo_safety_report_write_beta"\)===\"1\"/,
  "report writes require a separate explicit opt-in");
assert.match(indexHooks,/const REPORT_WRITES_ENABLED = false;/);
assert.match(indexHooks,/const ADMIN_QUEUE_ENABLED = false;/);
console.log("PASS: workers.dev-only BETA routes, script order, no-cache and writes disabled");
