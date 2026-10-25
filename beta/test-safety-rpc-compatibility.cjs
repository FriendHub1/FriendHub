"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const repoRoot=path.join(__dirname,"..");
const read=(p)=>fs.readFileSync(path.join(repoRoot,p),"utf8");
const sql=read("beta/stay-safe-conversation-reports-schema.sql");
const adapter=read("beta/admin-report-queue.js");
const admin=read("beta/admin-report-panel-bridge.js");
const chat=read("beta/stay-safe-chat-preview-bridge.js");
const worker=read("worker.js");
const pipeline=read("beta/report-rpc-writer.cjs");
for(const name of [
 "xoxo_submit_conversation_report_beta",
 "xoxo_admin_list_conversation_reports_beta",
 "xoxo_admin_update_conversation_report_beta"
]){
 assert.match(sql,new RegExp("create or replace function public\\."+name+"\\(","i"),
   "SQL draft missing function "+name);
 assert.ok([adapter,chat,pipeline].some(s=>s.includes(name)),
   "no frontend/adapter call for "+name);
}
assert.match(sql,/other_user_id as reported_user_id/);
assert.match(sql,/r\.message_ids/);
assert.match(adapter,/report\?\.reported_user_id \|\| report\?\.other_user_id/);
assert.match(adapter,/report\.message_ids\.length/);
assert.match(admin,/xoxoModerationPinAuthorize/);
assert.match(admin,/openXoxoDmConversation/);
assert.doesNotMatch(admin,/xoxo_admin_read_dm_page_pin/);
assert.match(worker,/url\.hostname\.endsWith\("\.workers\.dev"\)/);
assert.match(worker,/xoxo_safety_chat_beta/);
for(const asset of [
 "stay-safe-sweetheart.js",
 "stay-safe-report-form.js",
 "stay-safe-evidence-picker.js",
 "stay-safe-chat-preview-bridge.js"
]){
 assert.match(worker,new RegExp("/beta/"+asset.replace(/\./g,"\\.")));
 assert.ok(fs.readFileSync(path.join(__dirname,asset),"utf8").length>100);
}
console.log("PASS: SQL RPC names, report fields, existing PIN/viewer delegation and workers.dev-only preview wiring");
