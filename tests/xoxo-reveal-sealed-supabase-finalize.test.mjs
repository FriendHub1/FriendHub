import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRevealVerifiedFinalizeWithSealedSupabase} from '../supabase/functions/xoxo-reveal-upload/verified-finalize-service.mjs';
const bytes=new Uint8Array([4,5,6]),digest=createHash('sha256').update(bytes).digest('hex');
const ctx={attemptId:'11111111-1111-4111-8111-111111111111',senderId:'s',claimToken:'t',revealId:'22222222-2222-4222-8222-222222222222',dmId:'33333333-3333-4333-8333-333333333333',objectPath:'a/p.webp',payloadFingerprint:'f'.repeat(64)};
function setup({writerState='sealed',authorized=true}={}){
 const calls=[];
 const rows={
  xoxo_reveal_upload_attempts:{id:'11111111-1111-4111-8111-111111111111',sender_id:'s',payload_fingerprint:ctx.payloadFingerprint,status:'pending',writer_state:writerState},
  xoxo_reveals:{id:'22222222-2222-4222-8222-222222222222',dm_id:'33333333-3333-4333-8333-333333333333',upload_attempt_id:'11111111-1111-4111-8111-111111111111',sender_id:'s',recipient_id:'u',object_path:ctx.objectPath,payload_fingerprint:ctx.payloadFingerprint},
  direct_messages:{id:'33333333-3333-4333-8333-333333333333',sender_id:'s',recipient_id:'u'},
  xoxo_reveal_quota_reservations:{id:'q',upload_attempt_id:'11111111-1111-4111-8111-111111111111',sender_id:'s',byte_count:3,released_at:null},
  xoxo_reveal_upload_objects:{attempt_id:'11111111-1111-4111-8111-111111111111',sender_id:'s',bucket_id:'xoxo-reveal',object_path:ctx.objectPath,payload_fingerprint:ctx.payloadFingerprint,expected_sha256:digest}
 };
 const dbClient={from:table=>{calls.push(table);const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:rows[table],error:null})};return q;}};
 const storageClient={storage:{from:()=>({download:async()=>({data:{size:bytes.length,arrayBuffer:async()=>bytes.buffer},error:null})})}};
 const finalize=createRevealVerifiedFinalizeWithSealedSupabase({
  dbClient,storageClient,rpcClient:{rpc:async()=>{calls.push('finalize');return {data:'completed',error:null};}},
  verifyDmAuthorization:async()=>authorized,
  sha256:async b=>createHash('sha256').update(b).digest('hex')
 });
 return {finalize,calls};
}
test('sealed writer plus matching trusted evidence allows finalize RPC',async()=>{
 const {finalize,calls}=setup();
 assert.equal((await finalize(ctx)).ok,true);
 assert.equal(calls.includes('finalize'),true);
});
test('active writer blocks finalize RPC',async()=>{
 const {finalize,calls}=setup({writerState:'writing'});
 assert.equal((await finalize(ctx)).ok,false);
 assert.equal(calls.includes('finalize'),false);
});
test('idle writer blocks finalize RPC',async()=>{
 const {finalize,calls}=setup({writerState:'idle'});
 assert.equal((await finalize(ctx)).ok,false);
 assert.equal(calls.includes('finalize'),false);
});
test('unauthorized DM blocks finalize even with sealed writer',async()=>{
 const {finalize,calls}=setup({authorized:false});
 assert.equal((await finalize(ctx)).ok,false);
 assert.equal(calls.includes('finalize'),false);
});
