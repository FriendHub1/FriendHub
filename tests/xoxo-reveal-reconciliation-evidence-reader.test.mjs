import test from "node:test";
import assert from "node:assert/strict";
import {collectRevealUploadEvidence as collect} from "../supabase/functions/xoxo-reveal-upload/reconciliation-evidence-reader.mjs";
import {assessInterruptedRevealUpload as assess} from "../supabase/functions/xoxo-reveal-upload/reconciliation-policy.mjs";
const attempt={id:"attempt-1",sender_id:"sender-1",request_key:"request_key_00000001",status:"pending"};
const readers=(s="absent",m="absent",q="released")=>({
 readStorage:async()=>({authoritative:true,state:s}),
 readLinkedMessage:async()=>({authoritative:true,state:m,
  ...(m==="present"?{revealId:"r-1",dmId:"dm-1",senderId:"sender-1",attemptId:"attempt-1"}:{})}),
 readQuota:async()=>({authoritative:true,state:q})
});
test("reads absent artifacts and released quota without writes",async()=>{
 const evidence=await collect({attempt,...readers()});
 assert.deepEqual(evidence,{authoritative:true,storage:"absent",linkedMessage:"absent",quota:"released"});
 assert.equal(assess({attempt,evidence}).action,"close_without_retry");
});
test("linked private object and DM yield verification-only decision",async()=>{
 const evidence=await collect({attempt,...readers("present","present","reserved")});
 assert.equal(assess({attempt,evidence}).action,"verify_then_finalize");
});
test("orphan object is held for review",async()=>{
 const evidence=await collect({attempt,...readers("present","absent","reserved")});
 assert.equal(assess({attempt,evidence}).action,"manual_review");
});
test("reserved quota without artifacts is only eligible for verified refund",async()=>{
 const evidence=await collect({attempt,...readers("absent","absent","reserved")});
 assert.equal(assess({attempt,evidence}).action,"verify_then_refund");
});
test("failed reader returns unknown, never partial authoritative evidence",async()=>{
 const evidence=await collect({attempt,...readers(),
  readStorage:async()=>{throw new Error("timeout");}});
 assert.equal(evidence.authoritative,false);
 assert.equal(assess({attempt,evidence}).action,"manual_review");
});
test("mismatched attempt identity is rejected",async()=>{
 const evidence=await collect({attempt,...readers("present","present","reserved"),
  readLinkedMessage:async()=>({authoritative:true,state:"present",
   revealId:"r-1",dmId:"dm-1",senderId:"other",attemptId:"attempt-1"})});
 assert.equal(evidence.authoritative,false);
});
test("untrusted or invalid reader response fails closed",async()=>{
 const evidence=await collect({attempt,...readers(),
  readQuota:async()=>({authoritative:false,state:"released"})});
 assert.equal(evidence.authoritative,false);
});
