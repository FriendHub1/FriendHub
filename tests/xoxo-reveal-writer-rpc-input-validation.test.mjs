import test from 'node:test';
import assert from 'node:assert/strict';
import {createRevealWriterLeaseRpcAdapter} from '../supabase/functions/xoxo-reveal-upload/writer-lease-rpc-adapter.mjs';
test('invalid writer identity or lease duration never invokes privileged RPC',async()=>{
 let calls=0;
 const adapter=createRevealWriterLeaseRpcAdapter({rpcClient:{rpc:async()=>{calls++;return {data:true};}}});
 for(const identity of [
  {attemptId:' ',senderId:'s',writerToken:'t'},
  {attemptId:'a',senderId:42,writerToken:'t'},
  {attemptId:'a',senderId:'s',writerToken:'  '}
 ]){
  assert.equal(await adapter.beginWriter(identity),false);
  assert.equal(await adapter.renewWriter(identity),false);
  assert.equal(await adapter.sealWriter(identity),false);
 }
 const identity={attemptId:'a',senderId:'s',writerToken:'t'};
 for(const lease of [0,-1,1,14,1.5,121,NaN,Infinity,'90']){
  assert.equal(await adapter.beginWriter(identity,lease),false);
  assert.equal(await adapter.renewWriter(identity,lease),false);
 }
 assert.equal(calls,0);
 assert.equal(await adapter.beginWriter(identity,15),true);
 assert.equal(await adapter.beginWriter(identity,90),true);
 assert.equal(await adapter.renewWriter(identity,90),true);
 assert.equal(await adapter.sealWriter(identity),true);
 assert.equal(calls,4);
});
