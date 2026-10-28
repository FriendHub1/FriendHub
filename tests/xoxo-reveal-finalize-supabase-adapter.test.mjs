import test from 'node:test';
import assert from 'node:assert/strict';
import {createRevealFinalizeSupabaseAdapter as create} from '../supabase/functions/xoxo-reveal-upload/finalize-supabase-adapter.mjs';
const args={attemptId:'a',senderId:'s',claimToken:'t',revealId:'r',dmId:'d'};
test('calls reviewed v2 finalize RPC with exact trusted IDs',async()=>{
 const calls=[];
 const fn=create({rpcClient:{rpc:async(name,params)=>{calls.push({name,params});return {data:'completed',error:null};}}});
 assert.equal(await fn(args),'completed');
 assert.deepEqual(calls,[{name:'xoxo_reveal_finalize_upload_v2',params:{
  p_attempt_id:'a',p_sender_id:'s',p_claim_token:'t',p_reveal_id:'r',p_dm_id:'d'
 }}]);
});
test('same completed binding may be acknowledged idempotently',async()=>{
 const fn=create({rpcClient:{rpc:async()=>({data:'already_completed',error:null})}});
 assert.equal(await fn(args),'already_completed');
});
test('RPC errors fail closed',async()=>{
 const fn=create({rpcClient:{rpc:async()=>({data:null,error:{message:'forbidden'}})}});
 await assert.rejects(()=>fn(args),/Finalize RPC failed/);
});
test('unexpected RPC result is never success',async()=>{
 const fn=create({rpcClient:{rpc:async()=>({data:'pending',error:null})}});
 await assert.rejects(()=>fn(args),/Unexpected/);
});
test('missing identifiers fail before RPC',async()=>{
 let called=false;
 const fn=create({rpcClient:{rpc:async()=>{called=true;return {data:'completed'};}}});
 await assert.rejects(()=>fn({...args,claimToken:''}),/Missing/);
 assert.equal(called,false);
});
