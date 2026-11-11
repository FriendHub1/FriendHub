import test from 'node:test';
import assert from 'node:assert/strict';
import {createRevealWriterVerificationAdapter as create} from '../supabase/functions/xoxo-reveal-upload/writer-verification-supabase-adapter.mjs';
const ctx={attemptId:'a',senderId:'s',writerToken:'t',phase:'before_upload'};
test('verifies writer token through exact privileged RPC',async()=>{
 const calls=[];
 const verify=create({rpcClient:{rpc:async(...args)=>{calls.push(args);return {data:true,error:null};}}});
 assert.equal(await verify(ctx),true);
 assert.deepEqual(calls,[['xoxo_reveal_verify_writer_v1',{
  p_attempt_id:'a',p_sender_id:'s',p_writer_token:'t'
 }]]);
});
test('rejects false, malformed, and RPC errors',async()=>{
 for(const response of [{data:false,error:null},{data:'true',error:null},{data:true,error:{message:'no'}}]){
  const verify=create({rpcClient:{rpc:async()=>response}});
  assert.equal(await verify(ctx),false);
 }
});
test('network failures fail closed',async()=>{
 const verify=create({rpcClient:{rpc:async()=>{throw Error('timeout');}}});
 assert.equal(await verify(ctx),false);
});
test('invalid phase and missing token never call server',async()=>{
 let called=0;
 const verify=create({rpcClient:{rpc:async()=>{called++;return {data:true};}}});
 assert.equal(await verify({...ctx,phase:'unknown'}),false);
 assert.equal(await verify({...ctx,writerToken:''}),false);
 assert.equal(called,0);
});
