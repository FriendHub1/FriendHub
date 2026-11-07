import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {createRecipientBoundServerPipeline} from '../supabase/functions/xoxo-reveal-upload/recipient-bound-server-pipeline.mjs';

const senderId='11111111-1111-4111-8111-111111111111';
const recipientId='22222222-2222-4222-8222-222222222222';
const attemptId='33333333-3333-4333-8333-333333333333';
const ownerToken='44444444-4444-4444-8444-444444444444';
const revealId='55555555-5555-4555-8555-555555555555';
const dmId='66666666-6666-4666-8666-666666666666';
const bytes=Uint8Array.from([82,73,70,70,0,0,0,0,87,69,66,80,1,2,3]);
const request={authorization:'Bearer valid.token',recipientId,requestKey:'stable_request_key_123',bytes,claimedType:'image/webp',mode:'once'};
const authClient={auth:{getUser:async()=>({data:{user:{id:senderId}},error:null})}};

test('full trusted composition authenticates, hashes, claims, seals and atomically links',async()=>{
 const calls=[];
 const rpcClient={rpc:async(name,args)=>{
  calls.push(name);
  if(name==='xoxo_reveal_claim_upload_v2'){
   assert.equal(args.p_sender_id,senderId);
   assert.equal(args.p_recipient_id,recipientId);
   assert.match(args.p_payload_fingerprint,/^[0-9a-f]{64}$/);
   return {data:{action:'claimed',attempt_id:attemptId,owner_token:ownerToken}};
  }
  assert.equal(name,'xoxo_reveal_create_linked_dm_v1');
  assert.equal(args.p_attempt_id,attemptId);
  assert.equal(args.p_claim_token,ownerToken);
  assert.equal(args.p_object_path,'private/sealed.webp');
  return {data:{reveal_id:revealId,dm_id:dmId}};
 }};
 const process=createRecipientBoundServerPipeline({authClient,rpcClient,digest:webcrypto.subtle,
  prepareSealedUpload:async input=>{
   calls.push('sealed');
   assert.equal(input.claimToken,ownerToken);
   assert.deepEqual(input.bytes,bytes);
   return {objectPath:'private/sealed.webp',attemptId,senderId,recipientId,payloadFingerprint:input.payloadFingerprint,writerState:'sealed',uploadUncertain:false};
  }});
 assert.deepEqual(await process(request),{action:'delivered',revealId,dmId});
 assert.deepEqual(calls,['xoxo_reveal_claim_upload_v2','sealed','xoxo_reveal_create_linked_dm_v1']);
});

test('replay returns existing IDs without invoking Storage or atomic creation',async()=>{
 const calls=[];
 const rpcClient={rpc:async name=>{
  calls.push(name);
  return {data:{action:'return_existing',attempt_id:attemptId,reveal_id:revealId,dm_id:dmId}};
 }};
 const process=createRecipientBoundServerPipeline({authClient,rpcClient,digest:webcrypto.subtle,
  prepareSealedUpload:async()=>{throw Error('Storage must not be called');}});
 assert.deepEqual(await process(request),{action:'already_delivered',revealId,dmId});
 assert.deepEqual(calls,['xoxo_reveal_claim_upload_v2']);
});

test('uncertain sealing blocks atomic message creation',async()=>{
 const calls=[];
 const rpcClient={rpc:async name=>{
  calls.push(name);
  if(name==='xoxo_reveal_claim_upload_v2')return {data:{action:'claimed',attempt_id:attemptId,owner_token:ownerToken}};
  throw Error('Atomic RPC must not be called');
 }};
 const process=createRecipientBoundServerPipeline({authClient,rpcClient,digest:webcrypto.subtle,
  prepareSealedUpload:async input=>({objectPath:'private/sealed.webp',attemptId,senderId,recipientId,payloadFingerprint:input.payloadFingerprint,writerState:'sealed',uploadUncertain:true})});
 await assert.rejects(process(request),/Trusted sealed upload required/);
 assert.deepEqual(calls,['xoxo_reveal_claim_upload_v2']);
});
