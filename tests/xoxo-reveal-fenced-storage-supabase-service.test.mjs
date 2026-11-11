import test from 'node:test';
import assert from 'node:assert/strict';
import {createRevealFencedStorageService as create} from '../supabase/functions/xoxo-reveal-upload/fenced-storage-supabase-service.mjs';
const ctx={attemptId:'attempt',senderId:'sender',claimToken:'claim',writerToken:'writer'};
function harness({claim='claimed',verify=[true,true],failUpload=false}={}){
 const calls=[];let index=0;
 const send=create({
  rpcClient:{rpc:async(name,args)=>{
   calls.push(name);
   if(name==='xoxo_reveal_claim_writer_v1')return {data:claim,error:null};
   if(name==='xoxo_reveal_verify_writer_v1')return {data:verify[index++],error:null};
   throw Error('unexpected rpc');
  }},
  uploadPrivateObject:async()=>{calls.push('storage');if(failUpload)throw Error('timeout');return {stored:true};},
  markNeedsReconciliation:async()=>{calls.push('quarantine');}
 });
 return {send,calls};
}
test('server service wires claim -> verify -> Storage -> verify',async()=>{
 const {send,calls}=harness();
 const result=await send(ctx);
 assert.equal(result.ok,true);
 assert.deepEqual(calls,['xoxo_reveal_claim_writer_v1','xoxo_reveal_verify_writer_v1','storage','xoxo_reveal_verify_writer_v1']);
});
test('busy claim cannot write Storage',async()=>{
 const {send,calls}=harness({claim:'busy'});
 assert.equal((await send(ctx)).ok,false);
 assert.deepEqual(calls,['xoxo_reveal_claim_writer_v1']);
});
test('pre-upload verification failure prevents upload',async()=>{
 const {send,calls}=harness({verify:[false]});
 assert.equal((await send(ctx)).ok,false);
 assert.deepEqual(calls,['xoxo_reveal_claim_writer_v1','xoxo_reveal_verify_writer_v1']);
});
test('post-upload verification failure quarantines',async()=>{
 const {send,calls}=harness({verify:[true,false]});
 assert.equal((await send(ctx)).ok,false);
 assert.equal(calls.at(-1),'quarantine');
});
test('ambiguous Storage timeout quarantines',async()=>{
 const {send,calls}=harness({failUpload:true});
 assert.equal((await send(ctx)).ok,false);
 assert.equal(calls.at(-1),'quarantine');
});
test('missing trusted dependencies rejected',()=>{
 assert.throws(()=>create({}),/Trusted Storage/);
});
