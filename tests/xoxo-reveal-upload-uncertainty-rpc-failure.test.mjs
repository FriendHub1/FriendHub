import test from 'node:test';
import assert from 'node:assert/strict';
import {createRevealUploadUncertaintyRpcMarker} from '../supabase/functions/xoxo-reveal-upload/upload-uncertainty-rpc-adapter.mjs';
import {createRevealUploadUncertaintyGate} from '../supabase/functions/xoxo-reveal-upload/upload-uncertainty-gate.mjs';

const identity={attemptId:'attempt',senderId:'sender'};
test('invalid uncertainty identities never invoke RPC',async()=>{
 let calls=0;
 const marker=createRevealUploadUncertaintyRpcMarker({rpcClient:{rpc:async()=>{calls++;return {data:true,error:null};}}});
 for(const input of [{...identity,attemptId:' '},{...identity,senderId:7},{...identity,reason:'other'}])
  await assert.rejects(marker(input),TypeError);
 assert.equal(calls,0);
});
test('uncertainty marker rejects RPC outage and malformed response',async()=>{
 let mode='throw';
 const marker=createRevealUploadUncertaintyRpcMarker({rpcClient:{rpc:async()=>{
  if(mode==='throw')throw new Error('network');
  if(mode==='missing')return undefined;
  return {data:true,error:null};
 }}});
 await assert.rejects(marker(identity),/unavailable/);
 mode='missing';
 await assert.rejects(marker(identity),/rejected/);
 mode='ok';
 assert.equal(await marker(identity),true);
});
test('failed durable marker still blocks same-process retry',async()=>{
 let uploads=0;
 const marker=createRevealUploadUncertaintyRpcMarker({rpcClient:{rpc:async()=>{throw new Error('network');}}});
 const gate=createRevealUploadUncertaintyGate({
  uploadAndSeal:async()=>{uploads++;throw new Error('Storage ambiguous');},
  markUncertain:marker
 });
 await assert.rejects(gate.run(identity),/recording failed/);
 await assert.rejects(gate.run(identity),/requires reconciliation/);
 assert.equal(uploads,1);
});
