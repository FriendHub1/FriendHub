import test from 'node:test';
import assert from 'node:assert/strict';
import {createRevealUploadUncertaintyGate} from '../supabase/functions/xoxo-reveal-upload/upload-uncertainty-gate.mjs';
const identity={attemptId:'a',senderId:'s'};
test('successful upload is returned without reconciliation',async()=>{
 let marked=false;
 const gate=createRevealUploadUncertaintyGate({uploadAndSeal:async()=>({sealed:true}),markUncertain:async()=>{marked=true;}});
 assert.equal((await gate.run(identity)).sealed,true);
 assert.equal(marked,false);
});
test('timed-out upload is marked uncertain and retry is blocked',async()=>{
 let calls=0,marks=0;
 const gate=createRevealUploadUncertaintyGate({
  uploadAndSeal:async()=>{calls++;throw Error('timed out');},
  markUncertain:async()=>{marks++;}
 });
 await assert.rejects(()=>gate.run(identity),/timed out/);
 assert.equal(gate.isUncertain(identity),true);
 await assert.rejects(()=>gate.run(identity),/requires reconciliation/);
 assert.equal(calls,1);
 assert.equal(marks,1);
});
test('failed reconciliation recording still blocks same-process retry',async()=>{
 const gate=createRevealUploadUncertaintyGate({
  uploadAndSeal:async()=>{throw Error('timeout');},
  markUncertain:async()=>{throw Error('database down');}
 });
 await assert.rejects(()=>gate.run(identity),/recording failed/);
 await assert.rejects(()=>gate.run(identity),/requires reconciliation/);
});
test('concurrent same-attempt upload is blocked',async()=>{
 let release;
 const waiting=new Promise(resolve=>{release=resolve;});
 const gate=createRevealUploadUncertaintyGate({uploadAndSeal:async()=>{await waiting;return {sealed:true};},markUncertain:async()=>{}});
 const first=gate.run(identity);
 await assert.rejects(()=>gate.run(identity),/already in flight/);
 release();
 assert.equal((await first).sealed,true);
});
