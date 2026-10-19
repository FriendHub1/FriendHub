import test from "node:test";
import assert from "node:assert/strict";
import {createRevealReconciliationReaders} from "../supabase/functions/xoxo-reveal-upload/reconciliation-supabase-adapters.mjs";
import {collectRevealUploadEvidence} from "../supabase/functions/xoxo-reveal-upload/reconciliation-evidence-reader.mjs";
const attempt={id:"attempt-1",sender_id:"sender-1",request_key:"retry_request_0001",payload_fingerprint:"a".repeat(64)};
const linked={authoritative:true,state:"present",objectPath:"sender-1/private.webp",
 reveal:{id:"reveal-1",dm_id:"dm-1",sender_id:"sender-1",recipient_id:"recipient-1",
 upload_attempt_id:"attempt-1",payload_fingerprint:"a".repeat(64),object_path:"sender-1/private.webp"},
 dm:{id:"dm-1",sender_id:"sender-1",recipient_id:"recipient-1"}};
const storage={authoritative:true,state:"present",bucket:"xoxo-reveal",
 path:"sender-1/private.webp",attemptId:"attempt-1",senderId:"sender-1",fingerprint:"a".repeat(64)};
const quota={authoritative:true,state:"reserved",attemptId:"attempt-1",senderId:"sender-1"};
const readers=(overrides={})=>createRevealReconciliationReaders({
 getRevealAndDmByAttempt:async()=>linked,
 getPrivateObjectByPath:async()=>storage,
 getQuotaByAttempt:async()=>quota,...overrides
});
test("trusted matching linked Reveal, Storage and quota produce evidence",async()=>{
 const evidence=await collectRevealUploadEvidence({attempt,...readers()});
 assert.deepEqual(evidence,{authoritative:true,storage:"present",
  linkedMessage:"present",quota:"reserved",revealId:"reveal-1",dmId:"dm-1"});
});
test("wrong recipient invalidates linked DM evidence",async()=>{
 const r=readers({getRevealAndDmByAttempt:async()=>({
  ...linked,dm:{...linked.dm,recipient_id:"other"}
 })});
 assert.equal((await r.readLinkedMessage(attempt)).authoritative,false);
});
test("wrong sender or fingerprint invalidates linked evidence",async()=>{
 for(const reveal of [{...linked.reveal,sender_id:"other"},
   {...linked.reveal,payload_fingerprint:"b".repeat(64)}]){
  const r=readers({getRevealAndDmByAttempt:async()=>({...linked,reveal})});
  assert.equal((await r.readLinkedMessage(attempt)).authoritative,false);
 }
});
test("wrong storage bucket or owner fails closed",async()=>{
 for(const item of [{...storage,bucket:"dm-media"},{...storage,senderId:"other"}]){
  const r=readers({getPrivateObjectByPath:async()=>item});
  assert.equal((await r.readStorage(attempt)).authoritative,false);
 }
});
test("quota cannot be attributed to a different attempt",async()=>{
 const r=readers({getQuotaByAttempt:async()=>({...quota,attemptId:"other"})});
 assert.equal((await r.readQuota(attempt)).authoritative,false);
});
test("reader failures return unknown, not absent",async()=>{
 const r=readers({getPrivateObjectByPath:async()=>{throw Error("timeout");}});
 assert.equal((await r.readStorage(attempt)).state,"unknown");
});
test("no server-confirmed authority means no trusted evidence",async()=>{
 const r=readers({getRevealAndDmByAttempt:async()=>({...linked,authoritative:false})});
 assert.equal((await collectRevealUploadEvidence({attempt,...r})).authoritative,false);
});
