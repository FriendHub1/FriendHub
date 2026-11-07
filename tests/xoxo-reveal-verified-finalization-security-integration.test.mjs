import test from 'node:test';
import assert from 'node:assert/strict';
import {createRevealVerifiedFinalizeFromReaders} from '../supabase/functions/xoxo-reveal-upload/verified-finalize-service.mjs';

const ctx={attemptId:'attempt',senderId:'sender',claimToken:'secret',revealId:'reveal',dmId:'dm',objectPath:'private/photo.webp',payloadFingerprint:'b'.repeat(64)};
const valid={
 readAttempt:async()=>({authoritative:true,id:ctx.attemptId,senderId:ctx.senderId,payloadFingerprint:ctx.payloadFingerprint}),
 readRevealDm:async()=>({authoritative:true,attemptId:ctx.attemptId,revealId:ctx.revealId,dmId:ctx.dmId,senderId:ctx.senderId,objectPath:ctx.objectPath,payloadFingerprint:ctx.payloadFingerprint,authorizedAtLink:true,recipientMatches:true}),
 readStorageIntegrity:async()=>({authoritative:true,objectPath:ctx.objectPath,payloadFingerprint:ctx.payloadFingerprint,exists:true,digestVerified:true}),
 readQuota:async()=>({authoritative:true,attemptId:ctx.attemptId,senderId:ctx.senderId,active:true}),
 readWriter:async()=>({authoritative:true,attemptId:ctx.attemptId,senderId:ctx.senderId,safeForFinalize:true})
};
function harness(overrides={}){
 let rpcCalls=0;
 const finalize=createRevealVerifiedFinalizeFromReaders({...valid,...overrides,rpcClient:{rpc:async()=>{rpcCalls++;return {data:'completed',error:null};}}});
 return {finalize,getRpcCalls:()=>rpcCalls};
}
const cases=[
 ['wrong attempt fingerprint','readAttempt',{payloadFingerprint:'c'.repeat(64)}],
 ['wrong DM sender','readRevealDm',{senderId:'intruder'}],
 ['wrong private object path','readStorageIntegrity',{objectPath:'private/other.webp'}],
 ['Storage object missing','readStorageIntegrity',{exists:false}],
 ['quota no longer reserved','readQuota',{active:false}],
 ['writer lease unsafe','readWriter',{safeForFinalize:false}],
 ['DM recipient mismatch','readRevealDm',{recipientMatches:false}],
 ['untrusted evidence source','readStorageIntegrity',{authoritative:false}]
];
for(const [label,key,patch] of cases){
 test(label+' blocks finalize RPC',async()=>{
  const base=await valid[key]();
  const {finalize,getRpcCalls}=harness({[key]:async()=>({...base,...patch})});
  assert.deepEqual(await finalize(ctx),{ok:false,reason:'binding_evidence_not_verified'});
  assert.equal(getRpcCalls(),0);
 });
}
test('all trusted evidence permits exactly one finalize RPC',async()=>{
 const {finalize,getRpcCalls}=harness();
 assert.deepEqual(await finalize(ctx),{ok:true,reason:'completed'});
 assert.equal(getRpcCalls(),1);
});
