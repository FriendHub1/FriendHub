import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {createRecipientBoundRequestAdapter} from '../supabase/functions/xoxo-reveal-upload/recipient-bound-request-adapter.mjs';
import {createRecipientBoundClaimAdapter} from '../supabase/functions/xoxo-reveal-upload/recipient-bound-claim-adapter.mjs';
import {createRecipientBoundDeliveryCoordinator} from '../supabase/functions/xoxo-reveal-upload/recipient-bound-delivery-coordinator.mjs';
import {createAtomicRevealMessageAdapter} from '../supabase/functions/xoxo-reveal-upload/transactional-linked-message-adapter.mjs';
const senderId='11111111-1111-4111-8111-111111111111',recipientId='22222222-2222-4222-8222-222222222222';
const attemptId='33333333-3333-4333-8333-333333333333',ownerToken='44444444-4444-4444-8444-444444444444';
const revealId='55555555-5555-4555-8555-555555555555',dmId='66666666-6666-4666-8666-666666666666';
const bytes=Uint8Array.from([82,73,70,70,0,0,0,0,87,69,66,80,1,2,3]);
const input={authorization:'Bearer valid.token',recipientId,requestKey:'stable_request_key_123',bytes,claimedType:'image/webp',mode:'once'};
function setup({claimAction='claimed',sealUncertain=false,linkFails=false}={}){
 const calls=[];
 const authClient={auth:{getUser:async()=>({data:{user:{id:senderId}},error:null})}};
 const rpcClient={rpc:async(name,args)=>{
  calls.push(name);
  if(name==='xoxo_reveal_claim_upload_v2'){
   assert.equal(args.p_sender_id,senderId);
   assert.equal(args.p_recipient_id,recipientId);
   assert.match(args.p_payload_fingerprint,/^[a-f0-9]{64}$/);
   return {data:{action:claimAction,attempt_id:attemptId,owner_token:ownerToken,reveal_id:revealId,dm_id:dmId},error:null};
  }
  if(name==='xoxo_reveal_create_linked_dm_v1'){
   assert.equal(args.p_attempt_id,attemptId);
   assert.equal(args.p_claim_token,ownerToken);
   assert.equal(args.p_recipient_id,recipientId);
   if(linkFails)return {data:null,error:{message:'db failed'}};
   return {data:{reveal_id:revealId,dm_id:dmId},error:null};
  }
  throw new Error('Unexpected RPC');
 }};
 const deliverReveal=createRecipientBoundDeliveryCoordinator({
  claimUpload:createRecipientBoundClaimAdapter({rpcClient}),
  prepareSealedUpload:async x=>{
   calls.push('trusted-seal');
   assert.deepEqual(x.bytes,bytes);
   assert.equal(x.mime,'image/webp');
   return {objectPath:'private/sealed.webp',attemptId:x.attemptId,
    senderId:x.senderId,recipientId:x.recipientId,payloadFingerprint:x.payloadFingerprint,
    writerState:'sealed',uploadUncertain:sealUncertain};
  },
  createLinkedMessage:createAtomicRevealMessageAdapter({rpcClient})
 });
 return {process:createRecipientBoundRequestAdapter({authClient,deliverReveal,digest:webcrypto.subtle}),calls};
}
test('real adapters compose authenticated bytes, recipient claim, seal and atomic DM RPC',async()=>{
 const {process,calls}=setup();
 assert.deepEqual(await process(input),{action:'delivered',revealId,dmId});
 assert.deepEqual(calls,['xoxo_reveal_claim_upload_v2','trusted-seal','xoxo_reveal_create_linked_dm_v1']);
});
test('real claim adapter replay never touches Storage or creates another DM',async()=>{
 const {process,calls}=setup({claimAction:'return_existing'});
 assert.deepEqual(await process(input),{action:'already_delivered',revealId,dmId});
 assert.deepEqual(calls,['xoxo_reveal_claim_upload_v2']);
});
test('uncertain upload cannot reach atomic DM RPC',async()=>{
 const {process,calls}=setup({sealUncertain:true});
 await assert.rejects(process(input),/Trusted sealed upload required/);
 assert.deepEqual(calls,['xoxo_reveal_claim_upload_v2','trusted-seal']);
});
test('atomic database failure cannot report delivery',async()=>{
 const {process,calls}=setup({linkFails:true});
 await assert.rejects(process(input),/Atomic Reveal message creation unavailable/);
 assert.deepEqual(calls,['xoxo_reveal_claim_upload_v2','trusted-seal','xoxo_reveal_create_linked_dm_v1']);
});
