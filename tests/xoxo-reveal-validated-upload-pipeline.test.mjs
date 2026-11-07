import test from 'node:test';
import assert from 'node:assert/strict';
import {createRevealValidatedUploadPipeline as create} from '../supabase/functions/xoxo-reveal-upload/validated-upload-pipeline.mjs';
const bytes=new Uint8Array([82,73,70,70,0,0,0,0,87,69,66,80,86,80,56,32]);
const ctx={attemptId:'attempt',senderId:'sender',recipientId:'recipient',claimToken:'claim',writerToken:'writer',bytes,contentType:'image/webp',mode:'once',seconds:null};
function harness({authorized=true,claim='claimed',verify=[true,true],storageError=null}={}){
 const calls=[];let index=0;
 const pipeline=create({
  rpcClient:{rpc:async name=>{
   calls.push(name);
   return {data:name==='xoxo_reveal_claim_writer_v1'?claim:verify[index++],error:null};
  }},
  storageClient:{storage:{from:bucket=>({upload:async(path,body,options)=>{
   calls.push('storage');
   assert.equal(bucket,'xoxo-reveal');
   assert.equal(path,'attempt/photo.webp');
   assert.equal(body,bytes);
   assert.equal(options.upsert,false);
   return storageError?{data:null,error:storageError}:{data:{path},error:null};
  }})}},
  authorizeDm:async()=>{calls.push('dm');return authorized;},
  resolveServerObjectPath:async()=>{calls.push('path');return 'attempt/photo.webp';},
  markNeedsReconciliation:async()=>{calls.push('quarantine');}
 });
 return {pipeline,calls};
}
test('complete isolated preflight -> claim -> verify -> private Storage -> verify',async()=>{
 const {pipeline,calls}=harness();
 assert.equal((await pipeline(ctx)).ok,true);
 assert.deepEqual(calls,['dm','path','xoxo_reveal_claim_writer_v1','xoxo_reveal_verify_writer_v1','storage','xoxo_reveal_verify_writer_v1']);
});
test('unauthorized DM never claims writer or uploads',async()=>{
 const {pipeline,calls}=harness({authorized:false});
 assert.equal((await pipeline(ctx)).reason,'dm_not_authorized');
 assert.deepEqual(calls,['dm']);
});
test('invalid bytes rejected before any RPC',async()=>{
 const {pipeline,calls}=harness();
 assert.equal((await pipeline({...ctx,bytes:new Uint8Array([1])})).reason,'invalid_media');
 assert.deepEqual(calls,[]);
});
test('busy writer never uploads',async()=>{
 const {pipeline,calls}=harness({claim:'busy'});
 assert.equal((await pipeline(ctx)).ok,false);
 assert.equal(calls.includes('storage'),false);
});
test('Storage error triggers quarantine',async()=>{
 const {pipeline,calls}=harness({storageError:{message:'network'}});
 assert.equal((await pipeline(ctx)).ok,false);
 assert.equal(calls.at(-1),'quarantine');
});
test('post-upload owner loss triggers quarantine',async()=>{
 const {pipeline,calls}=harness({verify:[true,false]});
 assert.equal((await pipeline(ctx)).ok,false);
 assert.equal(calls.at(-1),'quarantine');
});
