import test from "node:test";
import assert from "node:assert/strict";
import {RevealIdempotencyCoordinator} from "../supabase/functions/xoxo-reveal-upload/idempotency-coordinator.mjs";
const senderId="verified-sender";
const key="reveal_retry_00000001";
const fingerprint="a".repeat(64);
const request=(run,extra={})=>({senderId,key,fingerprint,run,...extra});
test("repeated requests return same result without a second upload",async()=>{
 const coordinator=new RevealIdempotencyCoordinator();
 let uploads=0;
 const first=await coordinator.execute(request(async()=>{uploads++;return {revealId:"one"};}));
 const second=await coordinator.execute(request(async()=>{uploads++;return {revealId:"two"};}));
 assert.deepEqual(first,second);
 assert.equal(uploads,1);
});
test("concurrent requests share one in-flight operation",async()=>{
 const coordinator=new RevealIdempotencyCoordinator();
 let uploads=0;
 const run=async()=>{uploads++;await Promise.resolve();return {revealId:"same"};};
 const [a,b]=await Promise.all([
  coordinator.execute(request(run)),
  coordinator.execute(request(run))
 ]);
 assert.deepEqual(a,b);
 assert.equal(uploads,1);
});
test("same key with changed content is rejected",async()=>{
 const coordinator=new RevealIdempotencyCoordinator();
 await coordinator.execute(request(async()=>({revealId:"one"})));
 await assert.rejects(coordinator.execute(request(async()=>({revealId:"two"}),{
  fingerprint:"b".repeat(64)
 })),/different content/);
});
test("sender identities have independent idempotency scopes",async()=>{
 const coordinator=new RevealIdempotencyCoordinator();
 let uploads=0;
 await coordinator.execute(request(async()=>++uploads));
 await coordinator.execute(request(async()=>++uploads,{senderId:"another-verified-sender"}));
 assert.equal(uploads,2);
});
test("failed attempts may retry in isolated memory",async()=>{
 const coordinator=new RevealIdempotencyCoordinator();
 await assert.rejects(coordinator.execute(request(async()=>{throw new Error("failed");})),/failed/);
 const result=await coordinator.execute(request(async()=>({revealId:"retry"})));
 assert.equal(result.revealId,"retry");
});
