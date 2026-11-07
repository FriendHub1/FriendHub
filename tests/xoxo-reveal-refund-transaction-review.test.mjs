import test from "node:test";
import assert from "node:assert/strict";
import {reviewFencedRevealRefund as review} from "../supabase/functions/xoxo-reveal-upload/refund-transaction-review.mjs";
const attempt={id:"attempt-a",senderId:"sender-a",status:"failed"};
const nowMs=Date.parse("2026-10-19T12:00:00Z");
const evidence={
 authoritative:true,fenceId:"fence-a",attemptId:"attempt-a",senderId:"sender-a",
 storageExists:false,linkedMessageExists:false,
 quotaExists:true,quotaReleased:false,quotaReservationId:"quota-a",
 quotaAttemptId:"attempt-a",quotaSenderId:"sender-a",
 hasHold:false,hasUncertainOperation:false,checkedAt:"2026-10-19T11:59:55Z",
 snapshotConsistent:true,attemptLocked:true,quotaLocked:true,
 storageRecheckedAfterFence:true
};
const deps=()=>({
 attempt,nowMs,
 openTrustedFence:async()=>({id:"fence-a",attemptId:"attempt-a",senderId:"sender-a",active:true,authoritative:true,close:async()=>{}}),
 readEvidenceInsideFence:async()=>evidence
});
test("reviews complete evidence but does not execute refund",async()=>{
 const result=await review(deps());
 assert.equal(result.allowed,true);
 assert.equal(result.reservationId,"quota-a");
});
test("rejects wrong fence identity",async()=>{
 const d=deps();d.openTrustedFence=async()=>({id:"fence-a",attemptId:"other",senderId:"sender-a",active:true,authoritative:true});
 assert.equal((await review(d)).allowed,false);
});
test("rejects evidence from a different fence",async()=>{
 const d=deps();d.readEvidenceInsideFence=async()=>({...evidence,fenceId:"other"});
 assert.equal((await review(d)).allowed,false);
});
test("rejects missing locks or Storage recheck",async()=>{
 for(const changed of [{quotaLocked:false},{storageRecheckedAfterFence:false},{snapshotConsistent:false}]){
  const d=deps();d.readEvidenceInsideFence=async()=>({...evidence,...changed});
  assert.equal((await review(d)).allowed,false);
 }
});
test("rejects existing Storage object and pending attempt",async()=>{
 const d=deps();d.readEvidenceInsideFence=async()=>({...evidence,storageExists:true});
 assert.equal((await review(d)).allowed,false);
 assert.equal((await review({...deps(),attempt:{...attempt,status:"pending"}})).allowed,false);
});
test("fails closed on reader errors and closes fence",async()=>{
 let closed=false;
 const d=deps();
 d.openTrustedFence=async()=>({...await deps().openTrustedFence(),close:async()=>{closed=true;}});
 d.readEvidenceInsideFence=async()=>{throw Error("unavailable");};
 assert.equal((await review(d)).allowed,false);
 assert.equal(closed,true);
});
