import test from 'node:test';
import assert from 'node:assert/strict';
import {createRecipientBoundDeliveryCoordinator} from '../supabase/functions/xoxo-reveal-upload/recipient-bound-delivery-coordinator.mjs';
const input={senderId:'11111111-1111-4111-8111-111111111111',recipientId:'22222222-2222-4222-8222-222222222222',requestKey:'delivery_claim_12345',payloadFingerprint:'a'.repeat(64),mediaType:'image',mode:'once'};
const attemptId='33333333-3333-4333-8333-333333333333',ownerToken='44444444-4444-4444-8444-444444444444';
const revealId='55555555-5555-4555-8555-555555555555',dmId='66666666-6666-4666-8666-666666666666';
test('claimed upload seals before atomic linked DM delivery',async()=>{
 const calls=[];
 const deliver=createRecipientBoundDeliveryCoordinator({
  claimUpload:async x=>{calls.push('claim');assert.equal(x.recipientId,input.recipientId);return {action:'claimed',attemptId,ownerToken};},
  prepareSealedUpload:async x=>{calls.push('seal');assert.equal(x.claimToken,ownerToken);return {objectPath:'private/sealed.webp',attemptId,senderId:input.senderId,recipientId:input.recipientId,payloadFingerprint:input.payloadFingerprint,writerState:'sealed',uploadUncertain:false};},
  createLinkedMessage:async x=>{calls.push('link');assert.equal(x.objectPath,'private/sealed.webp');assert.equal(x.recipientId,input.recipientId);return {revealId,dmId};}
 });
 assert.deepEqual(await deliver(input),{action:'delivered',revealId,dmId});
 assert.deepEqual(calls,['claim','seal','link']);
});
test('existing, waiting and rejected attempts never write or create DM',async()=>{
 let writes=0;
 for(const [action,expected] of [['wait','pending'],['reject','rejected'],['manual_reconciliation','needs_reconciliation'],['return_existing','already_delivered']]){
  const deliver=createRecipientBoundDeliveryCoordinator({
   claimUpload:async()=>({action,attemptId,revealId,dmId}),
   prepareSealedUpload:async()=>{writes++;},
   createLinkedMessage:async()=>{writes++;}
  });
  const result=await deliver(input);
  assert.equal(result.action,expected);
 }
 assert.equal(writes,0);
});
test('unsealed attempts never create a linked message',async()=>{
 let linked=0;
 const deliver=createRecipientBoundDeliveryCoordinator({
  claimUpload:async()=>({action:'claimed',attemptId,ownerToken}),
  prepareSealedUpload:async()=>{throw Error('seal unavailable');},
  createLinkedMessage:async()=>{linked++;}
 });
 await assert.rejects(deliver(input),/seal unavailable/);
 assert.equal(linked,0);
});

test('mismatched sealed recipient, fingerprint or attempt never creates a DM',async()=>{
 for(const mismatch of [{recipientId:'99999999-9999-4999-8999-999999999999'},
  {payloadFingerprint:'b'.repeat(64)},{attemptId:'88888888-8888-4888-8888-888888888888'},
  {objectPath:'../outside.webp'}]){
  let linked=0;
  const deliver=createRecipientBoundDeliveryCoordinator({
   claimUpload:async()=>({action:'claimed',attemptId,ownerToken}),
   prepareSealedUpload:async()=>({objectPath:'private/sealed.webp',attemptId,senderId:input.senderId,recipientId:input.recipientId,payloadFingerprint:input.payloadFingerprint,writerState:'sealed',uploadUncertain:false,...mismatch}),
   createLinkedMessage:async()=>{linked++;return {revealId,dmId};}
  });
  await assert.rejects(deliver(input),/Trusted sealed upload required/);
  assert.equal(linked,0);
 }
});

test('mismatched or uncertain sealed evidence cannot create a DM',async()=>{
 for(const override of [{recipientId:input.senderId},{payloadFingerprint:'b'.repeat(64)},{writerState:'writing'},{uploadUncertain:true},{attemptId:ownerToken}]){
  let linked=0;
  const deliver=createRecipientBoundDeliveryCoordinator({
   claimUpload:async()=>({action:'claimed',attemptId,ownerToken}),
   prepareSealedUpload:async()=>({objectPath:'private/sealed.webp',attemptId,senderId:input.senderId,recipientId:input.recipientId,payloadFingerprint:input.payloadFingerprint,writerState:'sealed',uploadUncertain:false,...override}),
   createLinkedMessage:async()=>{linked++;}
  });
  await assert.rejects(deliver(input),/Trusted sealed upload required/);
  assert.equal(linked,0);
 }
});
