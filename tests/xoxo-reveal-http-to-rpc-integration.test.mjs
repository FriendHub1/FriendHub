import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {createRecipientBoundHttpHandler} from '../supabase/functions/xoxo-reveal-upload/recipient-bound-http-handler.mjs';
import {createRecipientBoundRequestAdapter} from '../supabase/functions/xoxo-reveal-upload/recipient-bound-request-adapter.mjs';
import {createRecipientBoundDeliveryCoordinator} from '../supabase/functions/xoxo-reveal-upload/recipient-bound-delivery-coordinator.mjs';
import {createRecipientBoundClaimAdapter} from '../supabase/functions/xoxo-reveal-upload/recipient-bound-claim-adapter.mjs';
import {createAtomicRevealMessageAdapter} from '../supabase/functions/xoxo-reveal-upload/transactional-linked-message-adapter.mjs';
const origin='https://xoxoavenue.com',sender='11111111-1111-4111-8111-111111111111',recipient='22222222-2222-4222-8222-222222222222';
const attempt='33333333-3333-4333-8333-333333333333',token='44444444-4444-4444-8444-444444444444';
const reveal='55555555-5555-4555-8555-555555555555',dm='66666666-6666-4666-8666-666666666666';
const bytes=Uint8Array.from([82,73,70,70,0,0,0,0,87,69,66,80,1,2,3]);
const request=()=>new Request(origin+'/reveal',{method:'POST',headers:{origin,authorization:'Bearer valid.token','content-type':'image/webp','x-reveal-recipient':recipient,'x-reveal-request-key':'integration_key_123456','x-reveal-mode':'once'},body:bytes});
function setup({action='claimed',sealFails=false}={}){
 const calls=[];
 const rpcClient={rpc:async(name,args)=>{
  calls.push(name);
  if(name==='xoxo_reveal_claim_upload_v2'){
   assert.equal(args.p_sender_id,sender);assert.equal(args.p_recipient_id,recipient);
   assert.match(args.p_payload_fingerprint,/^[0-9a-f]{64}$/);
   return {data:{action,attempt_id:attempt,...(action==='claimed'?{owner_token:token}:{}),...(action==='return_existing'?{reveal_id:reveal,dm_id:dm}:{})}};
  }
  if(name==='xoxo_reveal_create_linked_dm_v1'){
   assert.equal(args.p_claim_token,token);assert.equal(args.p_object_path,'private/sealed.webp');
   return {data:{reveal_id:reveal,dm_id:dm}};
  }
  throw Error('Unexpected RPC');
 }};
 const deliverReveal=createRecipientBoundDeliveryCoordinator({
  claimUpload:createRecipientBoundClaimAdapter({rpcClient}),
  prepareSealedUpload:async args=>{
   calls.push('seal');assert.deepEqual(args.bytes,bytes);assert.equal(args.mime,'image/webp');
   if(sealFails)throw Error('private writer unavailable');
   return {objectPath:'private/sealed.webp',attemptId:attempt,senderId:sender,recipientId:recipient,payloadFingerprint:args.payloadFingerprint,writerState:'sealed',uploadUncertain:false};
  },
  createLinkedMessage:createAtomicRevealMessageAdapter({rpcClient})
 });
 const authClient={auth:{getUser:async()=>({data:{user:{id:sender}},error:null})}};
 const processRecipientBoundRequest=createRecipientBoundRequestAdapter({authClient,deliverReveal,digest:webcrypto.subtle});
 return {handle:createRecipientBoundHttpHandler({allowedOrigin:origin,processRecipientBoundRequest}),calls};
}
test('HTTP, verified bytes, recipient claim, sealed writer and atomic RPC compose in order',async()=>{
 const {handle,calls}=setup();const response=await handle(request());
 assert.equal(response.status,201);assert.deepEqual(await response.json(),{action:'delivered',revealId:reveal,dmId:dm});
 assert.deepEqual(calls,['xoxo_reveal_claim_upload_v2','seal','xoxo_reveal_create_linked_dm_v1']);
});
test('replay does not start another Storage write or DM RPC',async()=>{
 const {handle,calls}=setup({action:'return_existing'});const response=await handle(request());
 assert.equal(response.status,200);assert.deepEqual(await response.json(),{action:'already_delivered',revealId:reveal,dmId:dm});
 assert.deepEqual(calls,['xoxo_reveal_claim_upload_v2']);
});
test('writer failure cannot create a DM or disclose private details',async()=>{
 const {handle,calls}=setup({sealFails:true});const response=await handle(request());
 assert.equal(response.status,503);assert.deepEqual(calls,['xoxo_reveal_claim_upload_v2','seal']);
 assert.doesNotMatch(await response.text(),/private writer|sealed.webp|token/);
});
