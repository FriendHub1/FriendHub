import test from 'node:test';
import assert from 'node:assert/strict';
import {createRevealVerifiedFinalizationService as create} from '../supabase/functions/xoxo-reveal-upload/verified-finalization-service.mjs';
const args={attemptId:'attempt',senderId:'sender',claimToken:'claim',revealId:'reveal',dmId:'dm',objectPath:'attempt/photo.webp',payloadFingerprint:'f'.repeat(64)};
const evidence={...args,authoritative:true,storageObjectVerified:true,storageDigestMatches:true,dmAuthorizedAtLink:true,recipientMatches:true,quotaReservationBound:true,writerStateSafe:true};
function harness({proof=evidence,result='completed',rpcError=null}={}){
 const calls=[];
 const finalize=create({
  readTrustedEvidence:async()=>{calls.push('proof');return proof;},
  rpcClient:{rpc:async(name,params)=>{calls.push('rpc');assert.equal(name,'xoxo_reveal_finalize_upload_v2');assert.equal(params.p_attempt_id,args.attemptId);return {data:result,error:rpcError};}}
 });
 return {finalize,calls};
}
test('trusted proof allows finalize RPC with exact attempt binding',async()=>{
 const {finalize,calls}=harness();
 assert.deepEqual(await finalize(args),{ok:true,reason:'completed'});
 assert.deepEqual(calls,['proof','rpc']);
});
test('missing digest proof never calls RPC',async()=>{
 const {finalize,calls}=harness({proof:{...evidence,storageDigestMatches:false}});
 assert.equal((await finalize(args)).reason,'binding_evidence_not_verified');
 assert.deepEqual(calls,['proof']);
});
test('DM mismatch never calls RPC',async()=>{
 const {finalize,calls}=harness({proof:{...evidence,dmId:'other'}});
 assert.equal((await finalize(args)).ok,false);
 assert.deepEqual(calls,['proof']);
});
test('RPC failure returns uncertain reconciliation, not success',async()=>{
 const {finalize,calls}=harness({rpcError:{message:'timeout'}});
 assert.equal((await finalize(args)).reason,'finalize_uncertain_manual_reconciliation');
 assert.deepEqual(calls,['proof','rpc']);
});
test('idempotent already-completed result is recognized',async()=>{
 const {finalize}=harness({result:'already_completed'});
 assert.equal((await finalize(args)).reason,'already_completed');
});
test('unexpected RPC data never reports success',async()=>{
 const {finalize}=harness({result:'pending'});
 assert.equal((await finalize(args)).ok,false);
});
