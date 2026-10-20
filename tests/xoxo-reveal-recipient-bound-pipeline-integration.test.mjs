import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {createRecipientBoundRequestAdapter} from '../supabase/functions/xoxo-reveal-upload/recipient-bound-request-adapter.mjs';
import {createRecipientBoundDeliveryCoordinator} from '../supabase/functions/xoxo-reveal-upload/recipient-bound-delivery-coordinator.mjs';

const senderId='11111111-1111-4111-8111-111111111111';
const recipientId='22222222-2222-4222-8222-222222222222';
const attemptId='33333333-3333-4333-8333-333333333333';
const ownerToken='44444444-4444-4444-8444-444444444444';
const revealId='55555555-5555-4555-8555-555555555555';
const dmId='66666666-6666-4666-8666-666666666666';
const bytes=Uint8Array.from([82,73,70,70,0,0,0,0,87,69,66,80,1,2,3,4]);
const authClient={auth:{getUser:async()=>({data:{user:{id:senderId}},error:null})}};
const request={authorization:'Bearer valid.test.token',recipientId,requestKey:'integration_test_123456',bytes,claimedType:'image/webp',mode:'once'};

test('authenticated bytes flow through recipient claim, trusted seal and atomic DM exactly once',async()=>{
 const calls=[];
 let fingerprint;
 const deliverReveal=createRecipientBoundDeliveryCoordinator({
  claimUpload:async args=>{calls.push('claim');assert.equal(args.senderId,senderId);assert.equal(args.recipientId,recipientId);fingerprint=args.payloadFingerprint;return {action:'claimed',attemptId,ownerToken};},
  prepareSealedUpload:async args=>{
   calls.push('seal');assert.deepEqual(args.bytes,bytes);assert.equal(args.mime,'image/webp');assert.equal(args.claimToken,ownerToken);
   return {objectPath:'private/reveal.webp',attemptId,senderId,recipientId,payloadFingerprint:fingerprint,writerState:'sealed',uploadUncertain:false};
  },
  createLinkedMessage:async args=>{calls.push('link');assert.equal(args.objectPath,'private/reveal.webp');return {revealId,dmId};}
 });
 const process=createRecipientBoundRequestAdapter({authClient,digest:webcrypto.subtle,deliverReveal});
 assert.deepEqual(await process(request),{action:'delivered',revealId,dmId});
 assert.deepEqual(calls,['claim','seal','link']);
});

test('idempotent replay returns existing DM without another private Storage write',async()=>{
 const calls=[];
 const deliverReveal=createRecipientBoundDeliveryCoordinator({
  claimUpload:async()=>{calls.push('claim');return {action:'return_existing',attemptId,revealId,dmId};},
  prepareSealedUpload:async()=>{calls.push('seal');throw Error('should not upload');},
  createLinkedMessage:async()=>{calls.push('link');throw Error('should not link');}
 });
 const process=createRecipientBoundRequestAdapter({authClient,digest:webcrypto.subtle,deliverReveal});
 assert.deepEqual(await process(request),{action:'already_delivered',revealId,dmId});
 assert.deepEqual(calls,['claim']);
});

test('untrusted seal cannot create a DM through the composed request pipeline',async()=>{
 let linked=0;
 const deliverReveal=createRecipientBoundDeliveryCoordinator({
  claimUpload:async()=>({action:'claimed',attemptId,ownerToken}),
  prepareSealedUpload:async()=>({objectPath:'private/reveal.webp',attemptId,senderId,recipientId,payloadFingerprint:'0'.repeat(64),writerState:'sealed',uploadUncertain:false}),
  createLinkedMessage:async()=>{linked++;}
 });
 const process=createRecipientBoundRequestAdapter({authClient,digest:webcrypto.subtle,deliverReveal});
 await assert.rejects(process(request),/Trusted sealed upload required/);
 assert.equal(linked,0);
});
