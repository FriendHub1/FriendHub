import test from 'node:test';
import assert from 'node:assert/strict';
import {createRevealWriterClaimAdapter} from '../supabase/functions/xoxo-reveal-upload/writer-claim-supabase-adapter.mjs';
const args={attemptId:'attempt',senderId:'sender',claimToken:'claim',writerToken:'writer'};
test('maps authenticated server claim to exact RPC argument names',async()=>{
 const calls=[];
 const claim=createRevealWriterClaimAdapter({rpcClient:{rpc:async(...v)=>{calls.push(v);return {data:'claimed',error:null};}}});
 assert.equal(await claim(args),'claimed');
 assert.deepEqual(calls,[['xoxo_reveal_claim_writer_v1',{
  p_attempt_id:'attempt',p_sender_id:'sender',p_claim_token:'claim',
  p_writer_token:'writer',p_lease_seconds:60
 }]]);
});
test('busy and reconciliation outcomes are preserved',async()=>{
 for(const value of ['busy','manual_reconciliation','not_owner','already_owned']){
  const claim=createRevealWriterClaimAdapter({rpcClient:{rpc:async()=>({data:value,error:null})}});
  assert.equal(await claim(args),value);
 }
});
test('network errors and unknown results fail closed',async()=>{
 const failed=createRevealWriterClaimAdapter({rpcClient:{rpc:async()=>({data:null,error:{message:'timeout'}})}});
 await assert.rejects(()=>failed(args),/RPC failed/);
 const malformed=createRevealWriterClaimAdapter({rpcClient:{rpc:async()=>({data:true,error:null})}});
 await assert.rejects(()=>malformed(args),/Unexpected/);
});
test('invalid input never calls RPC',async()=>{
 let calls=0;
 const claim=createRevealWriterClaimAdapter({rpcClient:{rpc:async()=>{calls++;return {data:'claimed'};}}});
 await assert.rejects(()=>claim({...args,leaseSeconds:null}),/Invalid/);
 await assert.rejects(()=>claim({...args,writerToken:''}),/Invalid/);
 assert.equal(calls,0);
});
test('no RPC client is rejected',()=>{
 assert.throws(()=>createRevealWriterClaimAdapter({}),/Trusted/);
});
