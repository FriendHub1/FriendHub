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
const request={authorization:'Bearer valid.token',recipientId,requestKey:'request_key_123456789',bytes,claimedType:'image/webp',mode:'once'};
const authClient={auth:{getUser:async()=>({data:{user:{id:senderId}},error:null})}};
test('authenticated bytes -> recipient-bound claim -> sealed evidence -> atomic DM, then safe replay',async()=>{
 const steps=[];
 let completed=false;
 let savedHash;
 const deliverReveal=createRecipientBoundDeliveryCoordinator({
  claimUpload:async args=>{
   steps.push('claim');
   assert.equal(args.senderId,senderId);
   assert.equal(args.recipientId,recipientId);
   if(completed){
    assert.equal(args.payloadFingerprint,savedHash);
    return {action:'return_existing',attemptId,revealId,dmId};
   }
   savedHash=args.payloadFingerprint;
   return {action:'claimed',attemptId,ownerToken};
  },
  prepareSealedUpload:async args=>{
   steps.push('seal');
   assert.equal(args.claimToken,ownerToken);
   assert.equal(args.mime,'image/webp');
   assert.deepEqual(args.bytes,bytes);
   assert.equal(args.payloadFingerprint,savedHash);
   return {objectPath:'private/reveal.webp',attemptId,senderId,recipientId,
    payloadFingerprint:args.payloadFingerprint,writerState:'sealed',uploadUncertain:false};
  },
  createLinkedMessage:async args=>{
   steps.push('link');
   assert.equal(args.objectPath,'private/reveal.webp');
   completed=true;
   return {revealId,dmId};
  }
 });
 const process=createRecipientBoundRequestAdapter({authClient,digest:webcrypto.subtle,deliverReveal});
 assert.deepEqual(await process(request),{action:'delivered',revealId,dmId});
 assert.deepEqual(await process(request),{action:'already_delivered',revealId,dmId});
 assert.deepEqual(steps,['claim','seal','link','claim']);
});
test('uncertain seal cannot reach atomic DM creation through authenticated request',async()=>{
 let links=0;
 const deliverReveal=createRecipientBoundDeliveryCoordinator({
  claimUpload:async()=>({action:'claimed',attemptId,ownerToken}),
  prepareSealedUpload:async args=>({objectPath:'private/reveal.webp',attemptId,senderId,recipientId,
   payloadFingerprint:args.payloadFingerprint,writerState:'writing',uploadUncertain:true}),
  createLinkedMessage:async()=>{links++;}
 });
 const process=createRecipientBoundRequestAdapter({authClient,digest:webcrypto.subtle,deliverReveal});
 await assert.rejects(process(request),/Trusted sealed upload required/);
 assert.equal(links,0);
});

test('pending, rejected and uncertain claims never touch the private writer',async()=>{
 for(const action of ['wait','reject','manual_reconciliation']){
  const steps=[];
  const deliverReveal=createRecipientBoundDeliveryCoordinator({
   claimUpload:async()=>{steps.push('claim');return {action,attemptId};},
   prepareSealedUpload:async()=>{steps.push('write');throw Error('unexpected upload');},
   createLinkedMessage:async()=>{steps.push('link');throw Error('unexpected DM');}
  });
  const process=createRecipientBoundRequestAdapter({authClient,digest:webcrypto.subtle,deliverReveal});
  const result=await process(request);
  assert.equal(result.action,action==='wait'?'pending':action==='reject'?'rejected':'needs_reconciliation');
  assert.deepEqual(steps,['claim']);
 }
});
test('authenticated invalid media cannot reach recipient claim',async()=>{
 let claims=0;
 const deliverReveal=createRecipientBoundDeliveryCoordinator({
  claimUpload:async()=>{claims++;return {action:'wait',attemptId};},
  prepareSealedUpload:async()=>{throw Error('unexpected upload');},
  createLinkedMessage:async()=>{throw Error('unexpected DM');}
 });
 const process=createRecipientBoundRequestAdapter({authClient,digest:webcrypto.subtle,deliverReveal});
 await assert.rejects(process({...request,claimedType:'image/png'}),/Unsupported or oversized media/);
 assert.equal(claims,0);
});

test('same retry key with changed bytes, recipient or mode cannot reuse the original claim',async()=>{
 const seen=new Map(),steps=[];
 const deliverReveal=createRecipientBoundDeliveryCoordinator({
  claimUpload:async args=>{
   steps.push('claim');
   const existing=seen.get(args.requestKey);
   if(existing)return existing.fingerprint===args.payloadFingerprint?{action:'wait',attemptId}:{action:'reject'};
   seen.set(args.requestKey,{fingerprint:args.payloadFingerprint});
   return {action:'wait',attemptId};
  },
  prepareSealedUpload:async()=>{throw Error('writer must not run');},
  createLinkedMessage:async()=>{throw Error('DM must not run');}
 });
 const process=createRecipientBoundRequestAdapter({authClient,digest:webcrypto.subtle,deliverReveal});
 assert.equal((await process(request)).action,'pending');
 const changedBytes=new Uint8Array(bytes);changedBytes[14]^=1;
 assert.equal((await process({...request,bytes:changedBytes})).action,'rejected');
 assert.equal((await process({...request,recipientId:'77777777-7777-4777-8777-777777777777'})).action,'rejected');
 assert.equal((await process({...request,mode:'keep'})).action,'rejected');
 assert.deepEqual(steps,['claim','claim','claim','claim']);
});
