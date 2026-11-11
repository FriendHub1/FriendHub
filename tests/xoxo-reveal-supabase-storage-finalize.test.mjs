import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRevealVerifiedFinalizeWithSupabaseStorage} from '../supabase/functions/xoxo-reveal-upload/verified-finalize-service.mjs';
const bytes=new Uint8Array([8,9,10]);
const digest=createHash('sha256').update(bytes).digest('hex');
const ctx={attemptId:'a',senderId:'s',claimToken:'t',revealId:'r',dmId:'d',objectPath:'a/photo.webp',payloadFingerprint:'f'.repeat(64)};
function setup({storedBytes=bytes,expectedSha256=digest,error=null}={}){
 const calls=[];
 const finalize=createRevealVerifiedFinalizeWithSupabaseStorage({
  rpcClient:{rpc:async()=>{calls.push('finalize');return {data:'completed',error:null};}},
  storageClient:{storage:{from:bucket=>{calls.push('bucket:'+bucket);return {download:async path=>{calls.push('download:'+path);return {data:{size:storedBytes.length,arrayBuffer:async()=>storedBytes.buffer.slice(storedBytes.byteOffset,storedBytes.byteOffset+storedBytes.byteLength)},error};}};}}},
  readAttempt:async()=>({authoritative:true,id:'a',senderId:'s',payloadFingerprint:ctx.payloadFingerprint}),
  readRevealDm:async()=>({authoritative:true,attemptId:'a',revealId:'r',dmId:'d',senderId:'s',objectPath:ctx.objectPath,payloadFingerprint:ctx.payloadFingerprint,authorizedAtLink:true,recipientMatches:true}),
  readQuota:async()=>({authoritative:true,attemptId:'a',senderId:'s',active:true}),
  readWriter:async()=>({authoritative:true,attemptId:'a',senderId:'s',safeForFinalize:true}),
  resolveObjectBinding:async()=>({authoritative:true,attemptId:'a',bucket:'xoxo-reveal',objectPath:ctx.objectPath,payloadFingerprint:ctx.payloadFingerprint,expectedSha256}),
  sha256:async b=>createHash('sha256').update(b).digest('hex')
 });
 return {finalize,calls};
}
test('private Supabase download and SHA-256 precede finalization',async()=>{
 const {finalize,calls}=setup();
 assert.equal((await finalize(ctx)).ok,true);
 assert.deepEqual(calls,['bucket:xoxo-reveal','download:a/photo.webp','finalize']);
});
test('tampered private bytes prevent finalization',async()=>{
 const {finalize,calls}=setup({storedBytes:new Uint8Array([1,2,3])});
 assert.equal((await finalize(ctx)).ok,false);
 assert.equal(calls.includes('finalize'),false);
});
test('Supabase download failure prevents finalization',async()=>{
 const {finalize,calls}=setup({error:{message:'forbidden'}});
 assert.equal((await finalize(ctx)).ok,false);
 assert.equal(calls.includes('finalize'),false);
});
