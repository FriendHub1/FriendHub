import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {createRecipientBoundRequestAdapter} from '../supabase/functions/xoxo-reveal-upload/recipient-bound-request-adapter.mjs';
import {createRecipientBoundDeliveryCoordinator} from '../supabase/functions/xoxo-reveal-upload/recipient-bound-delivery-coordinator.mjs';
import {createRecipientBoundClaimAdapter} from '../supabase/functions/xoxo-reveal-upload/recipient-bound-claim-adapter.mjs';

// Entire in-memory pipeline; NO production Supabase, Storage or HTTP calls.
const senderId='11111111-1111-4111-8111-111111111111';
const recipientId='22222222-2222-4222-8222-222222222222';
const attemptId='33333333-3333-4333-8333-333333333333';
const ownerToken='44444444-4444-4444-8444-444444444444';
const revealId='55555555-5555-4555-8555-555555555555';
const dmId='66666666-6666-4666-8666-666666666666';
const bytes=Uint8Array.from([82,73,70,70,0,0,0,0,87,69,66,80,1,2,3]);
const input={authorization:'Bearer valid.token',recipientId,requestKey:'stable_request_key_123',bytes,claimedType:'image/webp',mode:'once'};
function setup({replay=false,uncertain=false}={}){
 const events=[];let fingerprint;
 const rpcClient={rpc:async(name,args)=>{
  events.push('claim');
  assert.equal(name,'xoxo_reveal_claim_upload_v2');
  assert.equal(args.p_sender_id,senderId);
  assert.equal(args.p_recipient_id,recipientId);
  assert.match(args.p_payload_fingerprint,/^[0-9a-f]{64}$/);
  fingerprint=args.p_payload_fingerprint;
  return {data:replay?{action:'return_existing',attempt_id:attemptId,reveal_id:revealId,dm_id:dmId}:
   {action:'claimed',attempt_id:attemptId,owner_token:ownerToken},error:null};
 }};
 const claimUpload=createRecipientBoundClaimAdapter({rpcClient});
 const deliverReveal=createRecipientBoundDeliveryCoordinator({
  claimUpload,
  prepareSealedUpload:async args=>{
   events.push('seal');
   assert.equal(args.claimToken,ownerToken);
   assert.equal(args.payloadFingerprint,fingerprint);
   assert.deepEqual(args.bytes,bytes);
   assert.equal(args.mime,'image/webp');
   return {objectPath:'private/sealed.webp',attemptId,senderId,recipientId,
    payloadFingerprint:fingerprint,writerState:uncertain?'writing':'sealed',uploadUncertain:uncertain};
  },
  createLinkedMessage:async args=>{
   events.push('link');
   assert.equal(args.claimToken,ownerToken);
   assert.equal(args.objectPath,'private/sealed.webp');
   return {revealId,dmId};
  }
 });
 const process=createRecipientBoundRequestAdapter({
  authClient:{auth:{getUser:async()=>({data:{user:{id:senderId}},error:null})}},
  digest:webcrypto.subtle,deliverReveal
 });
 return {process,events};
}
test('authenticated bytes -> bound claim -> sealed upload -> atomic linked message',async()=>{
 const {process,events}=setup();
 assert.deepEqual(await process(input),{action:'delivered',revealId,dmId});
 assert.deepEqual(events,['claim','seal','link']);
});
test('idempotent replay never uploads or creates another DM',async()=>{
 const {process,events}=setup({replay:true});
 assert.deepEqual(await process(input),{action:'already_delivered',revealId,dmId});
 assert.deepEqual(events,['claim']);
});
test('uncertain upload cannot create a DM',async()=>{
 const {process,events}=setup({uncertain:true});
 await assert.rejects(process(input),/Trusted sealed upload required/);
 assert.deepEqual(events,['claim','seal']);
});
