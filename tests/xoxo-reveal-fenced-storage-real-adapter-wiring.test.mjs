import test from 'node:test';
import assert from 'node:assert/strict';
import {createRevealFencedStorageService} from '../supabase/functions/xoxo-reveal-upload/fenced-storage-supabase-service.mjs';
const ctx={attemptId:'attempt',senderId:'sender',claimToken:'claim',writerToken:'writer',
 objectPath:'attempt/file.webp',bytes:new Uint8Array([1,2]),contentType:'image/webp'};
function setup({storageResponse={data:{path:ctx.objectPath},error:null},verify=true}={}){
 const calls=[];
 const send=createRevealFencedStorageService({
  rpcClient:{rpc:async(name)=>{calls.push(name);return {data:name==='xoxo_reveal_claim_writer_v1'?'claimed':verify,error:null};}},
  storageClient:{storage:{from:bucket=>({upload:async(path,bytes,opts)=>{
   calls.push('storage');assert.equal(bucket,'xoxo-reveal');
   assert.equal(path,ctx.objectPath);assert.equal(bytes,ctx.bytes);
   assert.equal(opts.upsert,false);return storageResponse;
  }})}},
  markNeedsReconciliation:async()=>{calls.push('quarantine');}
 });
 return {send,calls};
}
test('wired private Storage adapter uploads only between two RPC checks',async()=>{
 const {send,calls}=setup();
 assert.equal((await send(ctx)).ok,true);
 assert.deepEqual(calls,['xoxo_reveal_claim_writer_v1','xoxo_reveal_verify_writer_v1','storage','xoxo_reveal_verify_writer_v1']);
});
test('Storage error response quarantines and never reports success',async()=>{
 const {send,calls}=setup({storageResponse:{data:null,error:{message:'denied'}}});
 const result=await send(ctx);
 assert.equal(result.ok,false);
 assert.equal(result.reason,'storage_write_uncertain_manual_reconciliation');
 assert.equal(calls.at(-1),'quarantine');
});
test('invalid content type quarantines without touching Storage',async()=>{
 const {send,calls}=setup();
 const result=await send({...ctx,contentType:'text/html'});
 assert.equal(result.ok,false);
 assert.equal(calls.includes('storage'),false);
 assert.equal(calls.at(-1),'quarantine');
});
test('failed preflight does not call private Storage',async()=>{
 const {send,calls}=setup({verify:false});
 assert.equal((await send(ctx)).ok,false);
 assert.equal(calls.includes('storage'),false);
});
