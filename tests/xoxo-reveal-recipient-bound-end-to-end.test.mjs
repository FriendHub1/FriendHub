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
const bytes=Uint8Array.from([82,73,70,70,0,0,0,0,87,69,66,80,1,2,3]);
const request={authorization:'Bearer valid.token',recipientId,requestKey:'integration_key_123456',bytes,claimedType:'image/webp',mode:'once'};
const authClient={auth:{getUser:async()=>({data:{user:{id:senderId}},error:null})}};

test('authenticated media -> bound claim -> sealed private upload -> atomic DM',async()=>{
 const steps=[];
 let fingerprint;
 const deliverReveal=createRecipientBoundDeliveryCoordinator({
  claimUpload:async claim=>{
   steps.push('claim');
   assert.equal(claim.senderId,senderId);
   assert.equal(claim.recipientId,recipientId);
   assert.match(claim.payloadFingerprint,/^[a-f0-9]{64}$/);
   fingerprint=claim.payloadFingerprint;
   return {action:'claimed',attemptId,ownerToken};
  },
  prepareSealedUpload:async upload=>{
   steps.push('seal');
   assert.deepEqual(upload.bytes,bytes);
   assert.equal(upload.mime,'image/webp');
   assert.equal(upload.claimToken,ownerToken);
   assert.equal(upload.payloadFingerprint,fingerprint);
   return {attemptId,senderId,recipientId,payloadFingerprint:fingerprint,
    objectPath:'private/reveal.webp',writerState:'sealed',uploadUncertain:false};
  },
  createLinkedMessage:async linked=>{
   steps.push('link');
   assert.equal(linked.objectPath,'private/reveal.webp');
   assert.equal(linked.claimToken,ownerToken);
   return {revealId,dmId};
  }
 });
 const process=createRecipientBoundRequestAdapter({authClient,digest:webcrypto.subtle,deliverReveal});
 assert.deepEqual(await process(request),{action:'delivered',revealId,dmId});
 assert.deepEqual(steps,['claim','seal','link']);
});

test('replayed request returns existing IDs without repeating private upload or DM',async()=>{
 const steps=[];
 const deliverReveal=createRecipientBoundDeliveryCoordinator({
  claimUpload:async()=>{steps.push('claim');return {action:'return_existing',attemptId,revealId,dmId};},
  prepareSealedUpload:async()=>{steps.push('seal');throw Error('duplicate upload');},
  createLinkedMessage:async()=>{steps.push('link');throw Error('duplicate DM');}
 });
 const process=createRecipientBoundRequestAdapter({authClient,digest:webcrypto.subtle,deliverReveal});
 assert.deepEqual(await process(request),{action:'already_delivered',revealId,dmId});
 assert.deepEqual(steps,['claim']);
});

test('uncertain private upload never creates a DM',async()=>{
 let links=0;
 const deliverReveal=createRecipientBoundDeliveryCoordinator({
  claimUpload:async()=>({action:'claimed',attemptId,ownerToken}),
  prepareSealedUpload:async upload=>({
   attemptId,senderId,recipientId,payloadFingerprint:upload.payloadFingerprint,
   objectPath:'private/reveal.webp',writerState:'sealed',uploadUncertain:true
  }),
  createLinkedMessage:async()=>{links++;return {revealId,dmId};}
 });
 const process=createRecipientBoundRequestAdapter({authClient,digest:webcrypto.subtle,deliverReveal});
 await assert.rejects(process(request),/Trusted sealed upload required/);
 assert.equal(links,0);
});
