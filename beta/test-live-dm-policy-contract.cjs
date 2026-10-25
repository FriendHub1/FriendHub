"use strict";
/* The deployment gate is a read-only catalog query, not a hidden migration.
 * The server RPC must continue to explicitly enforce the SELECT policy's
 * participant/clear constraints while operating as SECURITY DEFINER.
 */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const read=name=>fs.readFileSync(path.join(__dirname,name),"utf8");
const check=read("sql-verify-existing-dm-rls-readonly.sql");
const schema=read("stay-safe-conversation-reports-schema.sql");
assert.match(check,/from pg_catalog\.pg_policies/);
assert.match(check,/pg_catalog\.pg_class/);
assert.match(check,/BLOCK_RELEASE/);
assert.match(check,/count\(a\.policyname\)=1/,
  "another permissive or restrictive SELECT/ALL policy must block launch");
assert.match(check,/a\.relrowsecurity is true/);
assert.match(check,/a\.role_names='\{authenticated\}'/);
assert.match(check,/bf9b0ed4f378ca405a739cbd619a6819/);
assert.match(check,/19300d155780585259ede73ac370586c/);
assert.doesNotMatch(check,/\b(insert|update|delete|alter|drop|truncate|create|grant|revoke)\s+(into\s+|table\s+|function\s+|on\s+)?(?:public\.|auth\.|xoxo_safety_private\.)/i,
  "the production policy preflight must never write user data or schema");
for(const part of [
  "v_message.sender_id = v_reporter",
  "v_message.recipient_id = p_other_user_id",
  "v_message.sender_id = p_other_user_id",
  "v_message.recipient_id = v_reporter",
  "public.dm_conversation_clears dc",
  "dc.user_id = v_reporter",
  "dc.other_user_id = p_other_user_id",
  "v_message.created_at <= dc.cleared_at"
])assert.ok(schema.includes(part),"report RPC lost the live RLS-equivalent check: "+part);
console.log("PASS: live DM RLS deployment gate is read-only, fail-closed, and matches BETA server evidence authorization");
