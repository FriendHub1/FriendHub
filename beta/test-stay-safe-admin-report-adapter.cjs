"use strict";
// Integration-contract tests for the EXISTING xmm moderation area.
// Uses mock RPCs; never reads real private messages or contacts production.
const assert = require("node:assert/strict");
const {
  combine, load, updateStatus, openInExistingViewer, REASON_CODES
} = require("./stay-safe-admin-report-adapter.js");

const SELF = "44444444-4444-4444-8444-444444444444";
const OTHER = "33333333-3333-4333-8333-333333333333";
const REPORT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const REPORT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const MSG_A = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const MSG_B = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const legacy = {
  id: REPORT_A, message_id: MSG_A, reporter_id: SELF,
  reported_user_id: OTHER, reason: "threats", details: "Old report",
  status: "pending", created_at: "2026-10-24T12:00:00Z"
};
const conversation = {
  id: REPORT_B, reporter_id: SELF, reported_user_id: OTHER,
  reason_code: 1, details: "New report", message_ids: [MSG_A, MSG_B],
  status: "pending", created_at: "2026-10-25T12:00:00Z"
};
(async () => {
  assert.equal(REASON_CODES.length, 6);
  const merged = combine([legacy], [conversation]);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].kind, "conversation");
  assert.deepEqual(merged[0].evidenceIds, [MSG_A, MSG_B]);
  assert.equal(merged[0].reasonLabel, "Threats or blackmail");
  assert.equal(merged[1].kind, "single_message");
  assert.equal(merged[1].reason, "threats");
  assert.deepEqual(merged[1].evidenceIds, [MSG_A]);
  assert.equal(combine([legacy], [{ ...conversation, message_ids: [MSG_A, MSG_A] }]).length, 1);
  assert.equal(combine([legacy], [{ ...conversation, reported_user_id: SELF }]).length, 1);

  const called = [];
  const client = { rpc: async (name, args) => {
    called.push({ name, args });
    if (name === "get_xoxo_dm_reports") return { data: [legacy], error: null };
    if (name === "xoxo_admin_list_conversation_reports_beta") {
      return { data: [conversation], error: null };
    }
    if (name.endsWith("_status") || name.endsWith("_beta")) {
      return { data: true, error: null };
    }
    throw new Error("Unexpected RPC " + name);
  } };
  const loaded = await load({ client });
  assert.equal(loaded.ok, true);
  assert.deepEqual(loaded.rows.map(x => x.kind), ["conversation", "single_message"]);
  assert.deepEqual(called.slice(0, 2).map(x => x.name),
    ["get_xoxo_dm_reports", "xoxo_admin_list_conversation_reports_beta"]);

  const legacyOnly = await load({ client: { rpc: async name =>
    name === "get_xoxo_dm_reports" ? { data: [legacy], error: null }
      : { data: null, error: { message: "BETA not deployed or PIN expired" } }
  } });
  assert.equal(legacyOnly.ok, false);
  assert.equal(legacyOnly.reason, "beta_reports_unavailable");
  assert.equal(legacyOnly.legacyRows.length, 1, "Existing reports must survive BETA RPC failure");

  assert.deepEqual(await updateStatus({ client, report: merged[0], status: "reviewed" }),
    { ok: true, status: "reviewed" });
  assert.equal(called.at(-1).name, "xoxo_admin_update_conversation_report_beta");
  assert.deepEqual(await updateStatus({ client, report: merged[1], status: "resolved" }),
    { ok: true, status: "resolved" });
  assert.equal(called.at(-1).name, "update_xoxo_dm_report_status");
  const beforeBad = called.length;
  assert.equal((await updateStatus({ client, report: merged[0], status: "unapproved" })).reason,
    "invalid_input");
  assert.equal(called.length, beforeBad);

  let viewerArgs = null;
  const handedOff = await openInExistingViewer(merged[0], async c => {
    viewerArgs = c;
    // Existing openXoxoDmConversation handles PIN + reason + audit log.
  });
  assert.deepEqual(handedOff, { ok: true });
  assert.deepEqual(viewerArgs, { user_1: SELF, user_2: OTHER });
  viewerArgs = null;
  assert.equal((await openInExistingViewer(merged[1], async c => {viewerArgs = c;})).reason,
    "invalid_input");
  assert.equal(viewerArgs, null, "Legacy reports do not open a new conversation viewer");

  console.log("PASS: admin report merge, safe fallback, RPC routing and existing PIN-viewer handoff");
})().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
