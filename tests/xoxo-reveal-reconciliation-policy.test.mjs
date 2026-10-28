import test from "node:test";
import assert from "node:assert/strict";
import {assessInterruptedRevealUpload as assess} from "../supabase/functions/xoxo-reveal-upload/reconciliation-policy.mjs";
const attempt={id:"attempt",sender_id:"sender",request_key:"reveal_request_0001",status:"pending"};
const evidence={authoritative:true,storage:"absent",linkedMessage:"absent",quota:"released"};
test("completed attempt reuses existing result",()=>{
 assert.deepEqual(assess({attempt:{...attempt,status:"completed",reveal_id:"r",dm_id:"d"}}),
  {action:"return_existing",revealId:"r",dmId:"d"});
});
test("confirmed linked DM and storage require verification before finalize",()=>{
 const result=assess({attempt,evidence:{...evidence,storage:"present",
  linkedMessage:"present",quota:"reserved",revealId:"r",dmId:"d"}});
 assert.equal(result.action,"verify_then_finalize");
});
test("uploaded object without linked message requires manual review",()=>{
 assert.equal(assess({attempt,evidence:{...evidence,storage:"present"}}).reason,
  "orphan_object_possible");
});
test("reserved quota with no remote artifacts requires verified refund",()=>{
 assert.equal(assess({attempt,evidence:{...evidence,quota:"reserved"}}).action,
  "verify_then_refund");
});
test("no artifacts and released quota can close without retry",()=>{
 assert.equal(assess({attempt,evidence}).action,"close_without_retry");
});
test("unknown or untrusted evidence never authorizes action",()=>{
 assert.equal(assess({attempt,evidence:{...evidence,storage:"unknown"}}).action,"manual_review");
 assert.equal(assess({attempt,evidence:{...evidence,authoritative:false}}).action,"manual_review");
 assert.equal(assess({attempt}).action,"manual_review");
});
test("linked message without matching storage is inconsistent",()=>{
 assert.equal(assess({attempt,evidence:{...evidence,linkedMessage:"present",
  revealId:"r",dmId:"d"}}).reason,"inconsistent_linked_message");
});
