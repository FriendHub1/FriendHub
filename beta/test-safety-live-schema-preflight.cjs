"use strict";
/* Static guard for read-only live metadata preflight. The query itself is
 * explicitly executed by an operator via a read-only Supabase connection;
 * this CI test never connects to the hosted project.
 */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const sql=fs.readFileSync(path.join(__dirname,
  "stay-safe-live-schema-preflight.sql"),"utf8");
const executable=sql.replace(/--[^\r\n]*/g,"").trim();
assert.match(executable,/^with\s+required_columns\s*\(/i);
assert.match(executable,/required_functions\s*\(/i);
assert.match(executable,/required_rls\s*\(/i);
assert.match(executable,/pg_catalog\.pg_attribute/);
assert.match(executable,/rel\.relrowsecurity/);
assert.match(executable,/live_schema_compatible/);
assert.match(executable,/beta_submission_rpc_installed/);
assert.doesNotMatch(executable, /\b(insert|update|delete|alter|drop|truncate|create|grant|revoke|execute|perform|call|do)\b/i,
  "preflight must not contain database-changing statements or invoke RPCs");
assert.doesNotMatch(executable,/\bfrom\s+(?:public\.)?(?:direct_messages|auth\.sessions)\b/i,
  "preflight must never read private user/message rows");
assert.doesNotMatch(executable,/cxosofpxfmjkrhfabrqc|xoxoavenue\.com|https?:\/\//i,
  "preflight must be project-agnostic and contain no network targets");
console.log("PASS: live Supabase schema preflight is read-only catalog inspection");
