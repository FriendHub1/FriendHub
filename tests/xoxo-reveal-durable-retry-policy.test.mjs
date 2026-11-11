import test from "node:test";
import assert from "node:assert/strict";
import {decideRevealUploadRetry} from "../supabase/functions/xoxo-reveal-upload/durable-retry-policy.mjs";
const fingerprint="a".repeat(64);
const row=(status,more={})=>({
 payload_fingerprint:fingerprint,status,...more
});
test("new request can be claimed",()=>{
 assert.deepEqual(decideRevealUploadRetry({fingerprint}),{action:"claim_new"});
});
test("completed request returns existing IDs without reupload",()=>{
 assert.deepEqual(decideRevealUploadRetry({fingerprint,
  attempt:row("completed",{reveal_id:"reveal-1",dm_id:"dm-1"})}),
  {action:"return_existing",revealId:"reveal-1",dmId:"dm-1"});
});
test("concurrent pending request waits instead of uploading twice",()=>{
 assert.equal(decideRevealUploadRetry({fingerprint,attempt:row("pending")}).action,"wait");
});
test("same key with different content is rejected",()=>{
 assert.equal(decideRevealUploadRetry({fingerprint,attempt:{
  ...row("completed"),payload_fingerprint:"b".repeat(64)
 }}).reason,"fingerprint_mismatch");
});
test("uncertain failed or expired lease never triggers blind retry",()=>{
 for(const status of ["failed","needs_reconciliation","unexpected"]){
  assert.equal(decideRevealUploadRetry({fingerprint,attempt:row(status)}).action,
   "manual_reconciliation");
 }
 assert.equal(decideRevealUploadRetry({fingerprint,attempt:row("completed")}).action,
  "manual_reconciliation");
});
