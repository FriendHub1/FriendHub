import test from "node:test";
import assert from "node:assert/strict";
import {assessRevealRefundReadiness as assess} from "../supabase/functions/xoxo-reveal-upload/refund-readiness-coordinator.mjs";
const nowMs=Date.parse("2026-10-19T12:00:00Z");
const attempt={id:"attempt-a",senderId:"sender-a",status:"failed"};
const evidence={
 authoritative:true,attemptId:"attempt-a",senderId:"sender-a",
 storageExists:false,linkedMessageExists:false,
 quotaExists:true,quotaReleased:false,quotaReservationId:"quota-a",
 quotaAttemptId:"attempt-a",quotaSenderId:"sender-a",
 hasHold:false,hasUncertainOperation:false,checkedAt:"2026-10-19T11:59:55Z",
 snapshotConsistent:true,attemptLocked:true,quotaLocked:true,
 storageRecheckedAfterFence:true
};
test("requires both authoritative failure and fresh fenced evidence",()=>{
 const result=assess({attempt,evidence,nowMs});
 assert.equal(result.allowed,true);
 assert.equal(result.reservationId,"quota-a");
});
test("rejects existing Storage object despite fresh evidence",()=>{
 assert.equal(assess({attempt,evidence:{...evidence,storageExists:true},nowMs}).allowed,false);
});
test("rejects stale evidence despite otherwise valid failure",()=>{
 assert.equal(assess({attempt,evidence:{...evidence,checkedAt:"2026-10-19T11:00:00Z"},nowMs}).allowed,false);
});
test("rejects missing transactional locks",()=>{
 assert.equal(assess({attempt,evidence:{...evidence,attemptLocked:false},nowMs}).allowed,false);
});
test("rejects pending attempt and active linked DM",()=>{
 assert.equal(assess({attempt:{...attempt,status:"pending"},evidence,nowMs}).allowed,false);
 assert.equal(assess({attempt,evidence:{...evidence,linkedMessageExists:true},nowMs}).allowed,false);
});
test("returns no reservation identifier on denial",()=>{
 const result=assess({attempt,evidence:{...evidence,hasUncertainOperation:true},nowMs});
 assert.equal(result.allowed,false);
 assert.equal(Object.hasOwn(result,"reservationId"),false);
});
