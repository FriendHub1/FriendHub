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
  ["deny-all by default test gate", /create table if not exists xoxo_safety_private\.report_beta_testers/i],
  ["test gate RLS", /alter table xoxo_safety_private\.report_beta_testers enable row level security/i],
  ["allowlisted reporter only", /from xoxo_safety_private\.report_beta_testers tester\s+where tester\.user_id = v_reporter and tester\.expires_at > now\(\)/i],
  ["report RLS", /alter table xoxo_safety_private\.conversation_reports enable row level security/i],
  ["evidence RLS", /alter table xoxo_safety_private\.conversation_report_evidence enable row level security/i],
  ["authenticated identity", /v_reporter uuid := auth\.uid\(\)/i],
  ["session verification helper", /create or replace function xoxo_safety_private\.active_session_for\(/i],
  ["server-side Auth sessions lookup", /from auth\.sessions s/i],
  ["signed JWT session identity", /auth\.jwt\(\)\s*->>\s*'session_id'/i],
  ["anonymous Supabase Auth sign-ins cannot submit", /auth\.jwt\(\)\s*->>\s*'is_anonymous'\)\s*is distinct from 'true'/i],
  ["session time-box enforcement", /s\.not_after is null or s\.not_after > now\(\)/i],
  ["1-20 messages", /cardinality\(p_message_ids\) not between 1 and 20/i],
  ["six report reasons", /p_reason_code not between 0 and 5/i],
  ["details maximum", /char_length\(p_details\) > 2000/i],
  ["duplicate evidence rejection", /v_distinct_count <> cardinality\(p_message_ids\)/i],
  ["serial limit lock", /pg_advisory_xact_lock/i],
  ["24 hour rate limit", /interval '24 hours'/i],
  ["idempotency pair", /unique \(reporter_id, idempotency_key\)/i],
  ["RLS clear visibility", /public\.dm_conversation_clears/i],
  ["immutable evidence row lock", /from public\.direct_messages dm\s*where dm\.id = any\(v_normalized_ids\)\s*for share\s*loop/i],
  ["reject disappearing whispers", /v_message\.whisper_id is not null/i],
  ["reject once-view or other non-normal media", /coalesce\(v_message\.media_view_mode,\s*'normal'\)\s*<>\s*'normal'/i],
  ["PIN-gated report queue", /xoxo_admin_list_conversation_reports_beta/i],
  ["pending priority before the 100-card cap",
    /order by\s*\(r\.status\s*=\s*'pending'\)\s*desc,\s*r\.created_at\s*desc,\s*r\.id\s*desc\s*limit\s+100/i],
  ["pending priority in returned JSON array",
    /order by\s*\(x\.status\s*=\s*'pending'\)\s*desc,\s*x\.created_at\s*desc/i],
  ["PIN-gated status updates", /xoxo_admin_update_conversation_report_beta/i],
  ["PIN expiration enforced", /ps\.verified_until > now\(\)/i],
  ["PIN lockout enforced", /ps\.locked_until is null or ps\.locked_until <= now\(\)/i],
  ["existing moderation audit", /insert into public\.xoxo_message_access_log/i],
  ["report queue read audited", /conversation_report_queue:view count=/i],
  ["paginated queue RPC", /create or replace function public\.xoxo_admin_page_conversation_reports_beta\(/i],
  ["server counts physically unavailable selected evidence", /as unavailable_evidence_count/i],
  ["keyset comparison", /\(\(r\.status = 'pending'\), r\.created_at, r\.id\)\s*<\s*\(p_after_pending, p_after_created_at, p_after_id\)/i],
  ["page size capped", /p_limit not between 1 and 50/i],
  ["page audit", /conversation_report_page:view count=/i],
  ["no partial evidence commit", /Evidence could not be saved atomically/i],
  ["explicit anon revocation", /from public, anon, authenticated/i],
  ["authenticated RPC grant", /to authenticated;/i],
  ["admin reason is a required RPC parameter", /xoxo_admin_list_conversation_reports_beta\(\s*p_reason text\s*\)/i],
  ["status reason is a required RPC parameter", /xoxo_admin_update_conversation_report_beta\(\s*p_report_id uuid,\s*p_status text,\s*p_reason text\s*\)/i],
  ["moderation audit includes specific report id", /'conversation_report_status:'\s*\|\|\s*p_status\s*\|\|\s*': report='\s*\|\|\s*p_report_id::text/i],
  ["moderation audit records previous status", /' previous='\s*\|\|\s*v_previous_status/i],
  ["status transition serialized by row lock", /from xoxo_safety_private\.conversation_reports r\s*where r\.id = p_report_id\s*for update/i],
  ["moderation audit includes reason", /' reason='\s*\|\|\s*v_reason/i],
  ["audit log reason forbids control characters", /v_reason\s*~\s*'\[\[:cntrl:\]\]'/i],
  ["fixed search path", /set search_path = ''/i]
];
for (const [name, pattern] of required) {
  assert.match(source, pattern, `Required safety contract missing: ${name}`);
}
assert.equal((source.match(/xoxo_safety_private\.active_session_for\((?:v_reporter|auth\.uid\(\))\)/g)||[]).length,4,
  "Submission, initial queue, paginated queue, and status updates must all reject revoked sessions");
assert.match(source,/revoke all on function xoxo_safety_private\.active_session_for\(uuid\)/i,
  "Private session guard must not be executable by public roles");
assert.equal((source.match(/security definer/g)||[]).length,4,
  "Only four reviewed public BETA RPCs may use SECURITY DEFINER");
assert.equal((source.match(/conversation_report_queue:view count=/g)||[]).length,1,
  "Every successful admin queue read must be audited exactly once");
assert.equal((source.match(/pg_catalog\.length\(v_reason\) not between 10 and 300/g)||[]).length,3,
  "All three admin RPCs must reject missing, short or oversized moderation reasons");
assert.equal((source.match(/v_reason\s*~\s*'\[\[:cntrl:\]\]'/g)||[]).length,3,
  "All three admin RPCs must reject multiline/control-character audit log injection");
assert.equal((source.match(/as unavailable_evidence_count/g)||[]).length,2,
  "both PIN-gated queue RPCs must report selected evidence no longer present");
assert.doesNotMatch(source,/select\s+dm\.(?:content|attachment_path)\b/i,
  "PIN report list may count unavailable evidence IDs, never read DM bodies or media paths");
assert.match(source,/revoke all on function public\.xoxo_admin_list_conversation_reports_beta\(text\)/i);
assert.match(source,/revoke all on function public\.xoxo_admin_update_conversation_report_beta\(uuid, text, text\)/i);
assert.match(source,/revoke all on function\s+public\.xoxo_admin_page_conversation_reports_beta\(\s*text,boolean,timestamptz,uuid,integer\)/i);
// Regression guards for real PostgreSQL errors found by the BETA PR checks.
// FOR KEY SHARE does not block non-key UPDATEs to a validated DM.
assert.doesNotMatch(source, /^\s*for key share(?:\s+loop)?\s*$/im,
  "Evidence snapshot must forbid concurrent non-key UPDATE, not only DELETE");
assert.doesNotMatch(source, /pg_catalog\.coalesce\s*\(/i,
  "COALESCE is a SQL expression, not a schema-qualified function");
const dbTests = fs.readFileSync(path.join(__dirname, "sql-test-report-pipeline.sql"), "utf8");
assert.ok(!dbTests.split(/\r?\n/).some(line =>
  line.trim() === "do $" || line.trim() === "end $;"),
  "All PL/pgSQL DO blocks must use double-dollar delimiters");
assert.doesNotMatch(source, /\b(?:drop|truncate)\s+table\s+(?:public\.)?direct_message_reports/i);
assert.doesNotMatch(source, /\b(?:update|delete\s+from)\s+public\.direct_message_reports\b/i);
assert.doesNotMatch(source, /\bgrant\s+(?:select|insert|update|delete|all)\s+on\s+(?:all\s+tables|xoxo_safety_private\.)[^;]*to\s+(?:anon|authenticated)/i);
console.log(`PASS: ${required.length} static SQL safety checks (not a database execution test)`);
