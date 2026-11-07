import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRevealVerifiedFinalizeWithStorage} from '../supabase/functions/xoxo-reveal-upload/verified-finalize-service.mjs';
const bytes=new Uint8Array([1,2,3]);
const digest=createHash('sha256').update(bytes).digest('hex');
const ctx={attemptId:'a',senderId:'s',claimToken:'t',revealId:'r',dmId:'d',objectPath:'a/photo.webp',payloadFingerprint:'f'.repeat(64)};
function setup(expectedSha256=digest,allowed=true){
 const calls=[];
 const finalize=createRevealVerifiedFinalizeWithStorage({
  rpcClient:{rpc:async()=>{calls.push('rpc');return {data:'completed',error:null};}},
  readAttempt:async()=>({authoritative:true,id:'a',senderId:'s',payloadFingerprint:ctx.payloadFingerprint}),
  readRevealDm:async()=>({authoritative:true,attemptId:'a',revealId:'r',dmId:'d',senderId:'s',objectPath:ctx.objectPath,payloadFingerprint:ctx.payloadFingerprint,authorizedAtLink:allowed,recipientMatches:true}),
  readQuota:async()=>({authoritative:true,attemptId:'a',senderId:'s',active:true}),
  readWriter:async()=>({authoritative:true,attemptId:'a',senderId:'s',safeForFinalize:true}),
  resolveObjectBinding:async()=>({authoritative:true,attemptId:'a',bucket:'xoxo-reveal',objectPath:ctx.objectPath,payloadFingerprint:ctx.payloadFingerprint,expectedSha256}),
  readPrivateBytes:async()=>{calls.push('bytes');return bytes;},
  sha256:async b=>createHash('sha256').update(b).digest('hex')
 });
 return {finalize,calls};
}
test('matching bytes digest permits RPC',async()=>{
 const {finalize,calls}=setup();
 assert.equal((await finalize(ctx)).ok,true);
 assert.deepEqual(calls,['bytes','rpc']);
});
test('wrong digest blocks RPC',async()=>{
 const {finalize,calls}=setup('a'.repeat(64));
 assert.equal((await finalize(ctx)).ok,false);
 assert.deepEqual(calls,['bytes']);
});
test('unauthorized DM blocks RPC even with matching bytes',async()=>{
 const {finalize,calls}=setup(digest,false);
 assert.equal((await finalize(ctx)).ok,false);
 assert.deepEqual(calls,['bytes']);
});
