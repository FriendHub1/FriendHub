import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {createRecipientBoundServerPipeline} from '../supabase/functions/xoxo-reveal-upload/recipient-bound-server-composition.mjs';
const senderId='11111111-1111-4111-8111-111111111111',recipientId='22222222-2222-4222-8222-222222222222';
const attemptId='33333333-3333-4333-8333-333333333333',ownerToken='44444444-4444-4444-8444-444444444444';
const revealId='55555555-5555-4555-8555-555555555555',dmId='66666666-6666-4666-8666-666666666666';
const request={authorization:'Bearer valid.token',recipientId,requestKey:'pipeline_request_123',bytes:Uint8Array.from([82,73,70,70,0,0,0,0,87,69,66,80,1,2,3]),claimedType:'image/webp',mode:'once'};
const authClient={auth:{getUser:async()=>({data:{user:{id:senderId}},error:null})}};
test('composition requires a trusted sealed writer before any RPC',()=>{
 assert.throws(()=>createRecipientBoundServerPipeline({authClient,rpcClient:{rpc:async()=>({})},digest:webcrypto.subtle}),/Trusted Auth, RPC and sealed Storage writer required/);
});
test('composition uses recipient-bound claim and atomic DM RPC in order',async()=>{
 const calls=[];
 let fingerprint;
 const rpcClient={rpc:async(name,args)=>{
  calls.push(name);
  if(name==='xoxo_reveal_claim_upload_v2'){
   assert.equal(args.p_recipient_id,recipientId);
   fingerprint=args.p_payload_fingerprint;
   return {data:{action:'claimed',attempt_id:attemptId,owner_token:ownerToken}};
  }
  assert.equal(name,'xoxo_reveal_create_linked_dm_v1');
  assert.equal(args.p_attempt_id,attemptId);
  assert.equal(args.p_claim_token,ownerToken);
  assert.equal(args.p_object_path,'private/sealed.webp');
  return {data:{reveal_id:revealId,dm_id:dmId}};
 }};
 const process=createRecipientBoundServerPipeline({authClient,rpcClient,digest:webcrypto.subtle,
  prepareSealedUpload:async x=>{
   calls.push('sealed');
   assert.equal(x.payloadFingerprint,fingerprint);
   assert.deepEqual(x.bytes,request.bytes);
   return {attemptId,senderId,recipientId,payloadFingerprint:fingerprint,writerState:'sealed',uploadUncertain:false,objectPath:'private/sealed.webp'};
  }});
 assert.deepEqual(await process(request),{action:'delivered',revealId,dmId});
 assert.deepEqual(calls,['xoxo_reveal_claim_upload_v2','sealed','xoxo_reveal_create_linked_dm_v1']);
});
test('replay does not write or call atomic DM RPC',async()=>{
 let writes=0;
 const rpcClient={rpc:async name=>{
  if(name!=='xoxo_reveal_claim_upload_v2')throw Error('Unexpected DM write');
  return {data:{action:'return_existing',attempt_id:attemptId,reveal_id:revealId,dm_id:dmId}};
 }};
 const process=createRecipientBoundServerPipeline({authClient,rpcClient,digest:webcrypto.subtle,
  prepareSealedUpload:async()=>{writes++;throw Error('Unexpected Storage write');}});
 assert.deepEqual(await process(request),{action:'already_delivered',revealId,dmId});
 assert.equal(writes,0);
});
