"use strict";
/* Static defense for the repeatable live-Supabase schema gate.
 * The SQL file is executed separately, using SELECT only via the connector.
 */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const source=fs.readFileSync(path.join(__dirname,
  "sql-preflight-existing-supabase-schema-readonly.sql"),"utf8");

assert.match(source,/PURE READ-ONLY CATALOG QUERY/);
assert.match(source,/BLOCK_RELEASE/);
const code=source.replace(/--[^\r\n]*/g,"")
  .replace(/'(?:''|[^'])*'/g,"''");
assert.match(code,/^\s*with\s+required_columns\s*\(/i);
assert.equal((code.match(/;/g)||[]).length,1,"exactly one SELECT statement");
assert.match(code,/order by category,object_name;\s*$/i);
assert.doesNotMatch(code,/\b(?:insert|update|delete|create|alter|drop|truncate|grant|revoke|call|execute|copy|do)\b/i,
  "schema inventory must never mutate the live database");
assert.doesNotMatch(code,/\bfrom\s+(?:public\.)?(?:direct_messages|auth\.users|dm_conversation_clears)\b/i,
  "preflight reads system catalogs, never users' DM rows");

const columns=source.match(/with required_columns\([^]*?\bvalues\s*([^]*?)\), column_checks/i);
assert.ok(columns,"column contract must remain present");
assert.equal((columns[1].match(/\('(auth|public)'/g)||[]).length,18,
  "18 typed production dependencies are required");
const routines=source.match(/\), required_routines\([^]*?\bvalues\s*([^]*?)\), routine_checks/i);
assert.ok(routines,"function contract must remain present");
assert.equal((routines[1].match(/\('(auth|public)\./g)||[]).length,9,
  "9 actual Auth/PIN/legacy-viewer functions are required");
for(const name of [
  "xoxo_submit_conversation_report_beta",
  "xoxo_admin_list_conversation_reports_beta",
  "xoxo_admin_update_conversation_report_beta",
  "xoxo_admin_page_conversation_reports_beta"
])assert.ok(source.includes(name),"missing planned BETA RPC collision gate: "+name);
for(const name of [
  "xoxo_message_access_log", "xoxo_moderation_pin_security",
  "dm_conversation_clears", "direct_messages"
])assert.ok(source.includes(name),"missing production dependency: "+name);
assert.ok(source.includes("('auth','sessions','id','uuid',true)"),
  "missing live Supabase Auth session dependency");

console.log("PASS: read-only 36-check production schema preflight contract (no writes/content reads)");
