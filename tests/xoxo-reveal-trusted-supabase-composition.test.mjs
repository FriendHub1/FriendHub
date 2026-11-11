import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRevealVerifiedFinalizeFromTrustedSupabase} from '../supabase/functions/xoxo-reveal-upload/verified-finalize-service.mjs';
const bytes=new Uint8Array([1,2,3]),digest=createHash('sha256').update(bytes).digest('hex');
const ctx={attemptId:'11111111-1111-4111-8111-111111111111',senderId:'s',claimToken:'t',revealId:'22222222-2222-4222-8222-222222222222',dmId:'33333333-3333-4333-8333-333333333333',objectPath:'a/p.webp',payloadFingerprint:'f'.repeat(64)};
function setup({allowed=true,writerSafe=true,quotaActive=true,storedBytes=bytes}={}){
 const calls=[];
 const rows={
  xoxo_reveal_upload_attempts:{id:'11111111-1111-4111-8111-111111111111',sender_id:'s',payload_fingerprint:ctx.payloadFingerprint,status:'pending'},
  xoxo_reveals:{id:'22222222-2222-4222-8222-222222222222',dm_id:'33333333-3333-4333-8333-333333333333',upload_attempt_id:'11111111-1111-4111-8111-111111111111',sender_id:'s',recipient_id:'u',object_path:ctx.objectPath,payload_fingerprint:ctx.payloadFingerprint},
  direct_messages:{id:'33333333-3333-4333-8333-333333333333',sender_id:'s',recipient_id:'u'},
  xoxo_reveal_quota_reservations:{id:'q',upload_attempt_id:'11111111-1111-4111-8111-111111111111',sender_id:'s',byte_count:3,released_at:quotaActive?null:'2026-10-19'}
 };
 const dbClient={from:table=>{calls.push(table);const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:rows[table],error:null})};return q;}};
 const storageClient={storage:{from:()=>({download:async()=>({data:{size:storedBytes.length,arrayBuffer:async()=>storedBytes.buffer.slice(storedBytes.byteOffset,storedBytes.byteOffset+storedBytes.byteLength)},error:null})})}};
 const finalize=createRevealVerifiedFinalizeFromTrustedSupabase({
  dbClient,storageClient,rpcClient:{rpc:async()=>{calls.push('finalize');return {data:'completed',error:null};}},
  verifyDmAuthorization:async()=>allowed,
  verifyWriterFence:async()=>({authoritative:true,attemptId:'11111111-1111-4111-8111-111111111111',senderId:'s',safeForFinalize:writerSafe}),
  resolveObjectBinding:async()=>({authoritative:true,attemptId:'11111111-1111-4111-8111-111111111111',bucket:'xoxo-reveal',objectPath:ctx.objectPath,payloadFingerprint:ctx.payloadFingerprint,expectedSha256:digest}),
  sha256:async b=>createHash('sha256').update(b).digest('hex')
 });
 return {finalize,calls};
}
test('all five trusted readers permit matching verified finalize',async()=>{
 const {finalize,calls}=setup();
 assert.equal((await finalize(ctx)).ok,true);
 assert.equal(calls.includes('finalize'),true);
});
test('unauthorized DM prevents finalization',async()=>{
 const {finalize,calls}=setup({allowed:false});
 assert.equal((await finalize(ctx)).ok,false);
 assert.equal(calls.includes('finalize'),false);
});
test('unsafe writer prevents finalization',async()=>{
 const {finalize,calls}=setup({writerSafe:false});
 assert.equal((await finalize(ctx)).ok,false);
 assert.equal(calls.includes('finalize'),false);
});
test('released quota prevents finalization',async()=>{
 const {finalize,calls}=setup({quotaActive:false});
 assert.equal((await finalize(ctx)).ok,false);
 assert.equal(calls.includes('finalize'),false);
});
test('tampered Storage bytes prevent finalization',async()=>{
 const {finalize,calls}=setup({storedBytes:new Uint8Array([9,9,9])});
 assert.equal((await finalize(ctx)).ok,false);
 assert.equal(calls.includes('finalize'),false);
});
