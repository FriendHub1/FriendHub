import test from 'node:test';
import assert from 'node:assert/strict';
import {createRevealVerifiedFinalizeFromReaders} from '../supabase/functions/xoxo-reveal-upload/verified-finalize-service.mjs';

const ctx={attemptId:'attempt-1',senderId:'sender-1',claimToken:'server-secret',revealId:'reveal-1',dmId:'dm-1',objectPath:'private/attempt-1/photo.webp',payloadFingerprint:'a'.repeat(64)};
function setup(overrides={},rpcResult={data:'completed',error:null}){
 const calls=[];
 const readers={
  readAttempt:async()=>({authoritative:true,id:ctx.attemptId,senderId:ctx.senderId,payloadFingerprint:ctx.payloadFingerprint}),
  readRevealDm:async()=>({authoritative:true,attemptId:ctx.attemptId,revealId:ctx.revealId,dmId:ctx.dmId,senderId:ctx.senderId,objectPath:ctx.objectPath,payloadFingerprint:ctx.payloadFingerprint,authorizedAtLink:true,recipientMatches:true}),
  readStorageIntegrity:async()=>({authoritative:true,objectPath:ctx.objectPath,payloadFingerprint:ctx.payloadFingerprint,exists:true,digestVerified:true}),
  readQuota:async()=>({authoritative:true,attemptId:ctx.attemptId,senderId:ctx.senderId,active:true}),
  readWriter:async()=>({authoritative:true,attemptId:ctx.attemptId,senderId:ctx.senderId,safeForFinalize:true}),
  ...overrides
 };
 const finalize=createRevealVerifiedFinalizeFromReaders({
  ...readers,
  rpcClient:{rpc:async(name,params)=>{calls.push({name,params});return rpcResult;}}
 });
 return {finalize,calls};
}
test('verified Storage, DM, quota and writer evidence calls v2 RPC once',async()=>{
 const {finalize,calls}=setup();
 assert.deepEqual(await finalize(ctx),{ok:true,reason:'completed'});
 assert.deepEqual(calls,[{name:'xoxo_reveal_finalize_upload_v2',params:{
  p_attempt_id:ctx.attemptId,p_sender_id:ctx.senderId,p_claim_token:ctx.claimToken,
  p_reveal_id:ctx.revealId,p_dm_id:ctx.dmId
 }}]);
});
test('already completed is accepted only after evidence verification',async()=>{
 const {finalize,calls}=setup({}, {data:'already_completed',error:null});
 assert.deepEqual(await finalize(ctx),{ok:true,reason:'already_completed'});
 assert.equal(calls.length,1);
});
test('missing Storage digest never invokes RPC',async()=>{
 const {finalize,calls}=setup({readStorageIntegrity:async()=>({authoritative:true,objectPath:ctx.objectPath,payloadFingerprint:ctx.payloadFingerprint,exists:true,digestVerified:false})});
 assert.equal((await finalize(ctx)).reason,'binding_evidence_not_verified');
 assert.equal(calls.length,0);
});
test('unauthorized DM never invokes RPC',async()=>{
 const {finalize,calls}=setup({readRevealDm:async()=>({authoritative:true,attemptId:ctx.attemptId,revealId:ctx.revealId,dmId:ctx.dmId,senderId:ctx.senderId,objectPath:ctx.objectPath,payloadFingerprint:ctx.payloadFingerprint,authorizedAtLink:false,recipientMatches:true})});
 assert.equal((await finalize(ctx)).reason,'binding_evidence_not_verified');
 assert.equal(calls.length,0);
});
test('unsafe writer never invokes RPC',async()=>{
 const {finalize,calls}=setup({readWriter:async()=>({authoritative:true,attemptId:ctx.attemptId,senderId:ctx.senderId,safeForFinalize:false})});
 assert.equal((await finalize(ctx)).reason,'binding_evidence_not_verified');
 assert.equal(calls.length,0);
});
test('reader exception fails closed before RPC',async()=>{
 const {finalize,calls}=setup({readQuota:async()=>{throw Error('unavailable');}});
 assert.equal((await finalize(ctx)).reason,'binding_evidence_uncertain');
 assert.equal(calls.length,0);
});
test('RPC error requires reconciliation and is not success',async()=>{
 const {finalize,calls}=setup({}, {data:null,error:{message:'failed'}});
 assert.equal((await finalize(ctx)).reason,'finalize_uncertain_manual_reconciliation');
 assert.equal(calls.length,1);
});
test('invalid context never reads evidence or invokes RPC',async()=>{
 let reads=0;
 const {finalize,calls}=setup({readAttempt:async()=>{reads++;throw Error('should not read');}});
 assert.equal((await finalize({...ctx,claimToken:''})).reason,'invalid_binding_context');
 assert.equal(reads,0);
 assert.equal(calls.length,0);
});
