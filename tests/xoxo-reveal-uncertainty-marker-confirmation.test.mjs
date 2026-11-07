import test from 'node:test';
import assert from 'node:assert/strict';
import {createRevealUploadUncertaintyGate} from '../supabase/functions/xoxo-reveal-upload/upload-uncertainty-gate.mjs';

test('unconfirmed durable marker fails closed and blocks same-instance retry',async()=>{
 for(const confirmation of [false,null,undefined,{ok:true}]){
  let uploads=0,markers=0;
  const gate=createRevealUploadUncertaintyGate({
   uploadAndSeal:async()=>{uploads++;throw Error('remote write uncertain');},
   markUncertain:async()=>{markers++;return confirmation;}
  });
  const identity={attemptId:'attempt',senderId:'sender'};
  await assert.rejects(gate.run(identity),/reconciliation recording failed/);
  assert.equal(gate.isUncertain(identity),true);
  await assert.rejects(gate.run(identity),/requires reconciliation/);
  assert.equal(uploads,1);
  assert.equal(markers,1);
 }
});
test('confirmed durable marker preserves original upload error',async()=>{
 const gate=createRevealUploadUncertaintyGate({
  uploadAndSeal:async()=>{throw Error('remote timeout');},
  markUncertain:async()=>true
 });
 await assert.rejects(gate.run({attemptId:'attempt',senderId:'sender'}),/remote timeout/);
});
