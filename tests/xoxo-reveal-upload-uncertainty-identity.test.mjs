import test from 'node:test';
import assert from 'node:assert/strict';
import {createRevealUploadUncertaintyGate} from '../supabase/functions/xoxo-reveal-upload/upload-uncertainty-gate.mjs';

test('invalid identities never invoke Storage or mark uncertainty',async()=>{
 let uploads=0,markers=0;
 const gate=createRevealUploadUncertaintyGate({
  uploadAndSeal:async()=>{uploads++;return {created:true,sealed:true};},
  markUncertain:async()=>{markers++;return true;}
 });
 for(const input of [
  {attemptId:'',senderId:'sender'},
  {attemptId:'  ',senderId:'sender'},
  {attemptId:'attempt',senderId:' '},
  {attemptId:42,senderId:'sender'},
  {attemptId:'attempt',senderId:{id:'sender'}}
 ]){
  await assert.rejects(gate.run(input),TypeError);
 }
 assert.equal(uploads,0);
 assert.equal(markers,0);
});
test('uncertain upload blocks local retry after durable marker',async()=>{
 let uploads=0,markers=0;
 const gate=createRevealUploadUncertaintyGate({
  uploadAndSeal:async()=>{uploads++;throw new Error('storage failed');},
  markUncertain:async()=>{markers++;return true;}
 });
 const input={attemptId:'attempt',senderId:'sender'};
 await assert.rejects(gate.run(input),/storage failed/);
 assert.equal(gate.isUncertain(input),true);
 await assert.rejects(gate.run(input),/requires reconciliation/);
 assert.equal(uploads,1);
 assert.equal(markers,1);
});
