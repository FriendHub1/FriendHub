import test from 'node:test';
import assert from 'node:assert/strict';
import {createRevealVerifiedFinalizeService as create} from '../supabase/functions/xoxo-reveal-upload/verified-finalize-service.mjs';
const args={attemptId:'attempt',senderId:'sender',claimToken:'claim',revealId:'reveal',dmId:'dm',objectPath:'attempt/photo.webp',payloadFingerprint:'f'.repeat(64)};
const verified={...args,authoritative:true,storageObjectVerified:true,storageDigestMatches:true,dmAuthorizedAtLink:true,recipientMatches:true,quotaReservationBound:true,writerStateSafe:true};
function setup({evidence=verified,rpcResult='completed',rpcError=null}={}){
 const calls=[];
 const finalize=create({
  readTrustedEvidence:async()=>{calls.push('evidence');return evidence;},
  rpcClient:{rpc:async(name,params)=>{calls.push('rpc');assert.equal(name,'xoxo_reveal_finalize_upload_v2');assert.equal(params.p_attempt_id,args.attemptId);return {data:rpcResult,error:rpcError};}}
 });
 return {finalize,calls};
}
test('verified evidence calls server-only finalize RPC',async()=>{
 const {finalize,calls}=setup();
 assert.deepEqual(await finalize(args),{ok:true,reason:'completed'});
 assert.deepEqual(calls,['evidence','rpc']);
});
test('missing Storage digest never calls finalize RPC',async()=>{
 const {finalize,calls}=setup({evidence:{...verified,storageDigestMatches:false}});
 assert.equal((await finalize(args)).reason,'binding_evidence_not_verified');
 assert.deepEqual(calls,['evidence']);
});
test('wrong DM binding never calls finalize RPC',async()=>{
 const {finalize,calls}=setup({evidence:{...verified,dmId:'other'}});
 assert.equal((await finalize(args)).ok,false);
 assert.deepEqual(calls,['evidence']);
});
test('Supabase RPC error requires manual reconciliation',async()=>{
 const {finalize,calls}=setup({rpcError:{message:'timeout'},rpcResult:null});
 assert.equal((await finalize(args)).reason,'finalize_uncertain_manual_reconciliation');
 assert.deepEqual(calls,['evidence','rpc']);
});
test('idempotent completed response is accepted',async()=>{
 const {finalize}=setup({rpcResult:'already_completed'});
 assert.deepEqual(await finalize(args),{ok:true,reason:'already_completed'});
});
test('invalid server context never reads evidence',async()=>{
 const {finalize,calls}=setup();
 assert.equal((await finalize({...args,claimToken:''})).reason,'invalid_binding_context');
 assert.deepEqual(calls,[]);
});
