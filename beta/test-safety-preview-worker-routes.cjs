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
const chat=section('// Stay Safe, Sweetheart! — opt-in preview on workers.dev only.',
  '// Opt-in, branch-only preview of conversation reports');
const admin=section('// Opt-in, branch-only preview of conversation reports',
  'const xoxoShareLanguage =');
for(const [name,s,flag] of [
  ["chat",chat,"xoxo_safety_chat_beta"],
  ["admin",admin,"xoxo_safety_admin_beta"]
]){
  assert.match(s,/url\.hostname\.endsWith\("\.workers\.dev"\)/,
    name+" must not inject scripts on the public production domain");
  assert.match(s,/request\.method === "GET"/,
    name+" should not intercept POST or API traffic");
  assert.ok(s.includes('url.searchParams.get("'+flag+'") === "1"'),
    name+" must remain an explicit opt-in");
  assert.match(s,/headers\.set\("Cache-Control",\s*"no-store"\)/,
    name+" must not cache private pages");
}
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
  const at=chat.indexOf(filename);
  assert.ok(at>offset,"missing or out-of-order chat dependency: "+filename);
  offset=at;
}
assert.match(admin,/\/beta\/admin-report-queue\.js/);
assert.match(admin,/\/beta\/admin-report-panel-bridge\.js/);
assert.doesNotMatch(admin,/stay-safe-admin-reports-bridge\.js/,
  "do not inject the retired/draft alternative admin report adapter");
assert.match(preview,/const REPORT_RPC_WRITES_ENABLED=false;/,
  "preview must never send live database writes");
assert.match(indexHooks,/const REPORT_WRITES_ENABLED = false;/);
assert.match(indexHooks,/const ADMIN_QUEUE_ENABLED = false;/);
console.log("PASS: workers.dev-only BETA routes, script order, no-cache and writes disabled");
