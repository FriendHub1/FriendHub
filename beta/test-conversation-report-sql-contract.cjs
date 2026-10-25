"use strict";
// Static safety-contract checks for the REVIEW-ONLY SQL draft.
// These checks never connect to Supabase and do not replace live integration tests.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "stay-safe-conversation-reports-schema.sql"), "utf8");
const required = [
  ["review-only warning", /DO NOT APPLY TO THE LIVE DATABASE WITHOUT OWNER APPROVAL/i],
  ["private schema", /create schema if not exists xoxo_safety_private/i],
  ["reports table", /create table if not exists xoxo_safety_private\.conversation_reports/i],
  ["evidence table", /create table if not exists xoxo_safety_private\.conversation_report_evidence/i],
  ["report RLS", /alter table xoxo_safety_private\.conversation_reports enable row level security/i],
  ["evidence RLS", /alter table xoxo_safety_private\.conversation_report_evidence enable row level security/i],
  ["authenticated identity", /v_reporter uuid := auth\.uid\(\)/i],
  ["1-20 messages", /cardinality\(p_message_ids\) not between 1 and 20/i],
  ["six report reasons", /p_reason_code not between 0 and 5/i],
  ["details maximum", /char_length\(p_details\) > 2000/i],
  ["duplicate evidence rejection", /v_distinct_count <> cardinality\(p_message_ids\)/i],
  ["serial limit lock", /pg_advisory_xact_lock/i],
  ["24 hour rate limit", /interval '24 hours'/i],
  ["idempotency pair", /unique \(reporter_id, idempotency_key\)/i],
  ["RLS clear visibility", /public\.dm_conversation_clears/i],
  ["row-level lock", /for key share/i],
  ["PIN-gated report queue", /xoxo_admin_list_conversation_reports_beta/i],
  ["PIN-gated status updates", /xoxo_admin_update_conversation_report_beta/i],
  ["PIN expiration enforced", /ps\.verified_until > now\(\)/i],
  ["PIN lockout enforced", /ps\.locked_until is null or ps\.locked_until <= now\(\)/i],
  ["existing moderation audit", /insert into public\.xoxo_message_access_log/i],
  ["no partial evidence commit", /Evidence could not be saved atomically/i],
  ["explicit anon revocation", /from public, anon, authenticated/i],
  ["authenticated RPC grant", /to authenticated;/i],
  ["fixed search path", /set search_path = ''/i]
];
for (const [name, pattern] of required) {
  assert.match(source, pattern, `Required safety contract missing: ${name}`);
}
assert.doesNotMatch(source, /\b(?:drop|truncate)\s+table\s+(?:public\.)?direct_message_reports/i);
assert.doesNotMatch(source, /\b(?:update|delete\s+from)\s+public\.direct_message_reports\b/i);
assert.doesNotMatch(source, /\bgrant\s+(?:select|insert|update|delete|all)\s+on\s+(?:all\s+tables|xoxo_safety_private\.)[^;]*to\s+(?:anon|authenticated)/i);
console.log(`PASS: ${required.length} static SQL safety checks (not a database execution test)`);
