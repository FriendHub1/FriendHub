import test from "node:test";
import assert from "node:assert/strict";
import {createRevealLifecycleSimulation} from "./xoxo-reveal-upload-lifecycle-simulation.mjs";
const input={senderId:"sender",recipientId:"recipient",
 requestKey:"reveal_request_0001",fingerprint:"a".repeat(64)};
test("claim, upload, link and finalize create exactly one Reveal",async()=>{
 const h=createRevealLifecycleSimulation();
 assert.deepEqual(await h.send(input),{
  status:"completed",revealId:"reveal-1",dmId:"dm-1"
 });
 assert.deepEqual(h.counters,{claims:1,uploads:1,links:1,finalizations:1});
});
test("completed retry reuses original IDs without duplicate upload",async()=>{
 const h=createRevealLifecycleSimulation();
 await h.send(input);
 assert.equal((await h.send(input)).revealId,"reveal-1");
 assert.equal(h.counters.uploads,1);
 assert.equal(h.counters.finalizations,1);
});
test("interruption after claim cannot start a second upload",async()=>{
 const h=createRevealLifecycleSimulation();
 assert.equal((await h.send({...input,interruptAt:"after_claim"})).status,"interrupted");
 assert.equal((await h.send(input)).status,"pending");
 assert.equal(h.counters.uploads,0);
});
test("interruption after storage upload does not upload twice",async()=>{
 const h=createRevealLifecycleSimulation();
 await h.send({...input,interruptAt:"after_upload"});
 assert.equal((await h.send(input)).status,"pending");
 assert.equal(h.counters.uploads,1);
 assert.equal(h.messages.size,0);
});
test("interruption after DM link defers to reconciliation",async()=>{
 const h=createRevealLifecycleSimulation();
 await h.send({...input,interruptAt:"after_link"});
 assert.equal((await h.send(input)).status,"pending");
 assert.equal(h.counters.links,1);
 assert.equal(h.counters.finalizations,0);
});
test("lost response after finalize recovers existing result",async()=>{
 const h=createRevealLifecycleSimulation();
 await h.send({...input,interruptAt:"after_finalize"});
 assert.deepEqual(await h.send(input),{
  status:"completed",revealId:"reveal-1",dmId:"dm-1"
 });
 assert.equal(h.counters.uploads,1);
});
test("same key with different fingerprint is rejected",async()=>{
 const h=createRevealLifecycleSimulation();
 await h.send(input);
 assert.equal((await h.send({...input,fingerprint:"b".repeat(64)})).status,"rejected");
 assert.equal(h.counters.uploads,1);
});
