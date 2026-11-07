import test from 'node:test';
import assert from 'node:assert/strict';
import {createRevealWriterLeaseRpcAdapter} from '../supabase/functions/xoxo-reveal-upload/writer-lease-rpc-adapter.mjs';
const identity={attemptId:'a',senderId:'s',writerToken:'t'};
test('begin renew and seal use dedicated privileged RPCs',async()=>{
 const calls=[];
 const adapter=createRevealWriterLeaseRpcAdapter({rpcClient:{rpc:async(name,args)=>{calls.push({name,args});return {data:true,error:null};}}});
 assert.equal(await adapter.beginWriter(identity,60),true);
 assert.equal(await adapter.renewWriter(identity,45),true);
 assert.equal(await adapter.sealWriter(identity),true);
 assert.deepEqual(calls.map(c=>c.name),['xoxo_reveal_writer_begin_v3','xoxo_reveal_renew_writer_lease_v3','xoxo_reveal_writer_seal_v3']);
 assert.equal(calls[0].args.p_lease_seconds,60);
 assert.equal(calls[1].args.p_lease_seconds,45);
 assert.equal(calls[2].args.p_writer_token,'t');
});
test('RPC errors and malformed responses fail closed',async()=>{
 for(const response of [{data:false,error:null},{data:'true',error:null},{data:true,error:{message:'down'}}]){
  const adapter=createRevealWriterLeaseRpcAdapter({rpcClient:{rpc:async()=>response}});
  assert.equal(await adapter.renewWriter(identity),false);
 }
});
test('missing writer identity never calls RPC',async()=>{
 let called=false;
 const adapter=createRevealWriterLeaseRpcAdapter({rpcClient:{rpc:async()=>{called=true;return {data:true};}}});
 assert.equal(await adapter.beginWriter({...identity,writerToken:''}),false);
 assert.equal(called,false);
});
