import test from 'node:test';
import assert from 'node:assert/strict';
import {createRecipientBoundClaimAdapter} from '../supabase/functions/xoxo-reveal-upload/recipient-bound-claim-adapter.mjs';
const senderId='11111111-1111-4111-8111-111111111111';
const recipientId='22222222-2222-4222-8222-222222222222';
const attemptId='33333333-3333-4333-8333-333333333333';
const ownerToken='44444444-4444-4444-8444-444444444444';
const args={senderId,recipientId,requestKey:'recipient_claim_12345',payloadFingerprint:'a'.repeat(64)};
test('claims recipient-bound attempt through server RPC',async()=>{
 let calls=0;
 const claim=createRecipientBoundClaimAdapter({rpcClient:{rpc:async(name,params)=>{
  calls++;assert.equal(name,'xoxo_reveal_claim_upload_v2');
  assert.equal(params.p_recipient_id,recipientId);
  return {data:{action:'claimed',attempt_id:attemptId,owner_token:ownerToken}};
 }}});
 assert.deepEqual(await claim(args),{action:'claimed',attemptId,ownerToken});
 assert.equal(calls,1);
});
test('invalid recipient and fingerprint never reach RPC',async()=>{
 let calls=0;
 const claim=createRecipientBoundClaimAdapter({rpcClient:{rpc:async()=>{calls++;}}});
 await assert.rejects(claim({...args,recipientId:senderId}),TypeError);
 await assert.rejects(claim({...args,payloadFingerprint:'wrong'}),TypeError);
 assert.equal(calls,0);
});
test('completed replay returns stable identifiers without owner token',async()=>{
 const revealId='55555555-5555-4555-8555-555555555555';
 const dmId='66666666-6666-4666-8666-666666666666';
 const claim=createRecipientBoundClaimAdapter({rpcClient:{rpc:async()=>({data:[{action:'return_existing',attempt_id:attemptId,reveal_id:revealId,dm_id:dmId}]})}});
 assert.deepEqual(await claim(args),{action:'return_existing',attemptId,revealId,dmId});
});
test('network and malformed responses fail closed',async()=>{
 const failed=createRecipientBoundClaimAdapter({rpcClient:{rpc:async()=>{throw Error('secret');}}});
 await assert.rejects(failed(args),/Upload claim unavailable/);
 const malformed=createRecipientBoundClaimAdapter({rpcClient:{rpc:async()=>({data:{action:'claimed',attempt_id:attemptId}})}});
 await assert.rejects(malformed(args),/Missing private claim ownership/);
});
