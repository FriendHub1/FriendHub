import test from "node:test";
import assert from "node:assert/strict";
import {assessRevealRefundEvidence as assess} from "../supabase/functions/xoxo-reveal-upload/refund-evidence-policy.mjs";
const attempt={id:"attempt-a",senderId:"sender-a",status:"failed"};
const evidence={
 authoritative:true,attemptId:"attempt-a",senderId:"sender-a",
 storageExists:false,linkedMessageExists:false,
 quotaExists:true,quotaReleased:false,quotaReservationId:"quota-a",
 quotaAttemptId:"attempt-a",quotaSenderId:"sender-a",
 hasHold:false,hasUncertainOperation:false,checkedAt:"2026-10-19T10:00:00Z"
};
test("allows only complete authoritative negative Storage and DM evidence",()=>{
 assert.equal(assess({attempt,evidence}).allowed,true);
});
test("rejects pending or completed attempts",()=>{
 for(const status of ["pending","completed","needs_reconciliation"])
  assert.equal(assess({attempt:{...attempt,status},evidence}).allowed,false);
});
test("rejects unknown or present Storage and messages",()=>{
 for(const key of ["storageExists","linkedMessageExists"]){
  for(const value of [true,null,undefined])
   assert.equal(assess({attempt,evidence:{...evidence,[key]:value}}).allowed,false);
 }
});
test("rejects forged or nonauthoritative identity",()=>{
 for(const changed of [
  {authoritative:false},{attemptId:"other"},{senderId:"other"},
  {quotaAttemptId:"other"},{quotaSenderId:"other"}
 ]) assert.equal(assess({attempt,evidence:{...evidence,...changed}}).allowed,false);
});
test("rejects missing or already refunded quota",()=>{
 for(const changed of [
  {quotaExists:false},{quotaReleased:true},{quotaReservationId:""}
 ]) assert.equal(assess({attempt,evidence:{...evidence,...changed}}).allowed,false);
});
test("rejects holds, uncertain operations and absent timestamp",()=>{
 for(const changed of [
  {hasHold:true},{hasUncertainOperation:true},{checkedAt:null}
 ]) assert.equal(assess({attempt,evidence:{...evidence,...changed}}).allowed,false);
});
