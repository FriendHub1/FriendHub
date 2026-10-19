import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRevealVerifiedFinalizeFromBoundSupabase} from '../supabase/functions/xoxo-reveal-upload/verified-finalize-service.mjs';
const bytes=new Uint8Array([4,5,6]),digest=createHash('sha256').update(bytes).digest('hex');
const ctx={attemptId:'a',senderId:'s',claimToken:'t',revealId:'r',dmId:'d',objectPath:'a/p.webp',payloadFingerprint:'f'.repeat(64)};
function setup({storedBytes=bytes,expectedSha256=digest,authorized=true}={}){
 const calls=[];
 const rows={
  xoxo_reveal_upload_attempts:{id:'a',sender_id:'s',payload_fingerprint:ctx.payloadFingerprint,status:'pending'},
  xoxo_reveals:{id:'r',dm_id:'d',upload_attempt_id:'a',sender_id:'s',recipient_id:'u',object_path:ctx.objectPath,payload_fingerprint:ctx.payloadFingerprint},
  direct_messages:{id:'d',sender_id:'s',recipient_id:'u'},
  xoxo_reveal_quota_reservations:{id:'q',upload_attempt_id:'a',sender_id:'s',byte_count:3,released_at:null},
  xoxo_reveal_upload_objects:{attempt_id:'a',sender_id:'s',bucket_id:'xoxo-reveal',object_path:ctx.objectPath,payload_fingerprint:ctx.payloadFingerprint,expected_sha256:expectedSha256}
 };
 const dbClient={from:table=>{calls.push(table);const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:rows[table],error:null})};return q;}};
 const storageClient={storage:{from:()=>({download:async()=>({data:{size:storedBytes.length,arrayBuffer:async()=>storedBytes.buffer.slice(storedBytes.byteOffset,storedBytes.byteOffset+storedBytes.byteLength)},error:null})})}};
 const finalize=createRevealVerifiedFinalizeFromBoundSupabase({
  dbClient,storageClient,rpcClient:{rpc:async()=>{calls.push('finalize');return {data:'completed',error:null};}},
  verifyDmAuthorization:async()=>authorized,
  verifyWriterFence:async()=>({authoritative:true,attemptId:'a',senderId:'s',safeForFinalize:true}),
  sha256:async b=>createHash('sha256').update(b).digest('hex')
 });
 return {finalize,calls};
}
test('trusted DB object digest and actual Storage bytes permit finalize',async()=>{
 const {finalize,calls}=setup();
 assert.equal((await finalize(ctx)).ok,true);
 assert.equal(calls.includes('xoxo_reveal_upload_objects'),true);
 assert.equal(calls.includes('finalize'),true);
});
test('tampered bytes reject finalization',async()=>{
 const {finalize,calls}=setup({storedBytes:new Uint8Array([9,9,9])});
 assert.equal((await finalize(ctx)).ok,false);
 assert.equal(calls.includes('finalize'),false);
});
test('incorrect persisted digest rejects finalization',async()=>{
 const {finalize,calls}=setup({expectedSha256:'a'.repeat(64)});
 assert.equal((await finalize(ctx)).ok,false);
 assert.equal(calls.includes('finalize'),false);
});
test('DM authorization denial rejects finalization',async()=>{
 const {finalize,calls}=setup({authorized:false});
 assert.equal((await finalize(ctx)).ok,false);
 assert.equal(calls.includes('finalize'),false);
});
