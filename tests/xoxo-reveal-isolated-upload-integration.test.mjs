import test from "node:test";
import assert from "node:assert/strict";
import {createIsolatedRevealUploadHarness} from "./xoxo-reveal-isolated-upload-harness.mjs";
const photo=()=>{const b=new Uint8Array(40);b.set([82,73,70,70]);b.set([87,69,66,80],8);return b;};
test("isolated photo upload reserves quota, authorizes, stores and links",async()=>{
 const h=createIsolatedRevealUploadHarness();
 const result=await h.upload(photo());
 assert.deepEqual(result,{revealId:"reveal-1",dmId:"dm-1"});
 assert.deepEqual(h.calls,["reserve","authorize","path","store","link"]);
 assert.equal(h.objects.size,1);
 assert.equal(h.messages.length,1);
});
test("denied recipient prevents storage and refunds reservation",async()=>{
 const h=createIsolatedRevealUploadHarness({accepted:false});
 await assert.rejects(h.upload(photo()),/not authorized/);
 assert.equal(h.objects.size,0);
 assert.equal([...h.reservations.values()][0].released,true);
 assert.deepEqual(h.calls,["reserve","authorize","refund"]);
});
test("failed message linkage rolls back storage and refunds quota",async()=>{
 const h=createIsolatedRevealUploadHarness({failLink:true});
 await assert.rejects(h.upload(photo()),/Simulated link failure/);
 assert.equal(h.objects.size,0);
 assert.equal(h.messages.length,0);
 assert.deepEqual(h.calls,["reserve","authorize","path","store","link","rollback","refund"]);
});
test("quota denial prevents all upload and storage operations",async()=>{
 const h=createIsolatedRevealUploadHarness({quotaAllowed:false});
 await assert.rejects(h.upload(photo()),/quota exceeded/);
 assert.deepEqual(h.calls,["reserve"]);
 assert.equal(h.objects.size,0);
});
test("storage failure refunds reservation without linked message",async()=>{
 const h=createIsolatedRevealUploadHarness({failStorage:true});
 await assert.rejects(h.upload(photo()),/Simulated storage failure/);
 assert.equal(h.messages.length,0);
 assert.equal([...h.reservations.values()][0].released,true);
});
