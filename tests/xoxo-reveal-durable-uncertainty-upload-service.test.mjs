import test from 'node:test';
import assert from 'node:assert/strict';
import {createRevealDurableUncertaintyUploadService} from '../supabase/functions/xoxo-reveal-upload/durable-uncertainty-upload-service.mjs';
const input={attemptId:'attempt',senderId:'sender'};
function db(row){return {from(){return {select(){return this;},eq(){return this;},async maybeSingle(){return {data:row,error:null};}};}};}
test('persisted uncertainty prevents writes without creating a redundant marker',async()=>{
 let writes=0,markers=0;
 const service=createRevealDurableUncertaintyUploadService({
  dbClient:db({id:'attempt',sender_id:'sender',status:'pending',upload_uncertain_at:'now'}),
  rpcClient:{rpc:async()=>{markers++;return {data:true};}},
  uploadAndSeal:async()=>{writes++;return {sealed:true};}
 });
 await assert.rejects(service.run(input),/reconciliation required/);
 assert.equal(writes,0);
 assert.equal(markers,0);
});
test('post-preflight remote failure creates durable marker and blocks retry',async()=>{
 let writes=0,markers=0;
 const service=createRevealDurableUncertaintyUploadService({
  dbClient:db({id:'attempt',sender_id:'sender',status:'pending',upload_uncertain_at:null}),
  rpcClient:{rpc:async(name,args)=>{
   assert.equal(name,'xoxo_reveal_mark_upload_uncertain_v1');
   assert.equal(args.p_attempt_id,'attempt');
   markers++;return {data:true};
  }},
  uploadAndSeal:async()=>{writes++;throw Error('Storage outcome uncertain');}
 });
 await assert.rejects(service.run(input),/Storage outcome uncertain/);
 await assert.rejects(service.run(input),/requires reconciliation/);
 assert.equal(writes,1);
 assert.equal(markers,1);
 assert.equal(service.isUncertain(input),true);
});

test('locally uncertain retry stays blocked when DB becomes unavailable',async()=>{
 let reads=0,writes=0;
 const client={from(){reads++;if(reads>1)throw Error('database offline');
  return {select(){return this;},eq(){return this;},
   async maybeSingle(){return {data:{id:'attempt',sender_id:'sender',status:'pending',upload_uncertain_at:null},error:null};}
  };
 }};
 const service=createRevealDurableUncertaintyUploadService({
  dbClient:client,
  rpcClient:{rpc:async()=>({data:true})},
  uploadAndSeal:async()=>{writes++;throw Error('remote upload uncertain');}
 });
 await assert.rejects(service.run(input),/remote upload uncertain/);
 await assert.rejects(service.run(input),/requires reconciliation/);
 assert.equal(reads,1);
 assert.equal(writes,1);
});
