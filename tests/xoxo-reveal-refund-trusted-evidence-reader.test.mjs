import test from "node:test";
import assert from "node:assert/strict";
import {collectTrustedRefundEvidence as collect} from "../supabase/functions/xoxo-reveal-upload/refund-trusted-evidence-reader.mjs";
import {assessRevealRefundReadiness as assess} from "../supabase/functions/xoxo-reveal-upload/refund-readiness-coordinator.mjs";
const attempt={id:"attempt-a",senderId:"sender-a",status:"failed"};
const readers={
 readStorage:async()=>({authoritative:true,attemptId:"attempt-a",exists:false}),
 readLinkedDm:async()=>({authoritative:true,attemptId:"attempt-a",exists:false}),
 readQuota:async()=>({authoritative:true,attemptId:"attempt-a",senderId:"sender-a",exists:true,released:false,reservationId:"quota-a"}),
 readHold:async()=>({authoritative:true,attemptId:"attempt-a",exists:false}),
 readOperation:async()=>({authoritative:true,attemptId:"attempt-a",uncertain:false}),
 clock:()=>new Date("2026-10-19T12:00:00Z")
};
test("collects server-owned evidence but does not claim locks",async()=>{
 const evidence=await collect({attempt,...readers});
 assert.equal(evidence.authoritative,true);
 assert.equal(evidence.snapshotConsistent,false);
 assert.equal(evidence.attemptLocked,false);
 assert.equal(evidence.storageRecheckedAfterFence,false);
 assert.equal(assess({attempt,evidence,nowMs:Date.parse(evidence.checkedAt)}).allowed,false);
});
test("rejects incomplete trusted reader set",async()=>{
 const {readQuota,...rest}=readers;
 assert.equal((await collect({attempt,...rest})).authoritative,false);
});
test("rejects untrusted Storage result",async()=>{
 const evidence=await collect({attempt,...readers,readStorage:async()=>({authoritative:false,attemptId:"attempt-a",exists:false})});
 assert.equal(evidence.authoritative,false);
});
test("rejects mismatched quota sender",async()=>{
 const evidence=await collect({attempt,...readers,readQuota:async()=>({...await readers.readQuota(),senderId:"other"})});
 assert.equal(evidence.authoritative,false);
});
test("fails closed on reader error",async()=>{
 const evidence=await collect({attempt,...readers,readLinkedDm:async()=>{throw Error("timeout");}});
 assert.equal(evidence.authoritative,false);
});
test("rejects ambiguous Storage state",async()=>{
 const evidence=await collect({attempt,...readers,readStorage:async()=>({authoritative:true,attemptId:"attempt-a",exists:null})});
 assert.equal(evidence.authoritative,false);
});
