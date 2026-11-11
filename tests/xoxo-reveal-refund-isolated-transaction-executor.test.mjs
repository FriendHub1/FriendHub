import test from "node:test";
import assert from "node:assert/strict";
import {executeIsolatedRevealRefund as execute} from "../supabase/functions/xoxo-reveal-upload/refund-isolated-transaction-executor.mjs";
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
function harness(overrides={}){
 const calls=[];
 const tx={
  lockAttemptAndQuota:async()=>{calls.push("lock");return {id:"fence-a",attemptId:"attempt-a",senderId:"sender-a",active:true,authoritative:true};},
  readAuthoritativeEvidence:async()=>{calls.push("read");return evidence;},
  releaseQuota:async()=>{calls.push("release");return {authoritative:true,fenceId:"fence-a",reservationId:"quota-a",status:"released"};},
  ...overrides
 };
 return {calls,withTransaction:async callback=>{calls.push("begin");const result=await callback(tx);calls.push("commit");return result;}};
}
test("releases inside same transaction after locks and evidence",async()=>{
 const h=harness();
 const result=await execute({attempt,nowMs,withTransaction:h.withTransaction});
 assert.equal(result.ok,true);
 assert.deepEqual(h.calls,["begin","lock","read","release","commit"]);
});
test("denies when Storage exists, without calling release",async()=>{
 const h=harness({readAuthoritativeEvidence:async()=>({...evidence,storageExists:true})});
 assert.equal((await execute({attempt,nowMs,withTransaction:h.withTransaction})).ok,false);
 assert.equal(h.calls.includes("release"),false);
});
test("denies evidence from a different fence",async()=>{
 const h=harness({readAuthoritativeEvidence:async()=>({...evidence,fenceId:"other"})});
 assert.equal((await execute({attempt,nowMs,withTransaction:h.withTransaction})).ok,false);
 assert.equal(h.calls.includes("release"),false);
});
test("denies pending attempt",async()=>{
 const h=harness();
 assert.equal((await execute({attempt:{...attempt,status:"pending"},nowMs,withTransaction:h.withTransaction})).ok,false);
 assert.equal(h.calls.includes("release"),false);
});
test("denies unconfirmed release",async()=>{
 const h=harness({releaseQuota:async()=>({authoritative:false,status:"released"})});
 assert.equal((await execute({attempt,nowMs,withTransaction:h.withTransaction})).ok,false);
});
test("never reports success after uncertain transaction outcome",async()=>{
 const h=harness();
 const uncertain=async callback=>{await callback({
  lockAttemptAndQuota:async()=>({id:"fence-a",attemptId:"attempt-a",senderId:"sender-a",active:true,authoritative:true}),
  readAuthoritativeEvidence:async()=>evidence,
  releaseQuota:async()=>({authoritative:true,fenceId:"fence-a",reservationId:"quota-a",status:"released"})
 });throw Error("connection lost after commit");};
 assert.equal((await execute({attempt,nowMs,withTransaction:uncertain})).ok,false);
});
