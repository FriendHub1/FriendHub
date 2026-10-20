import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {createRecipientBoundRevealService} from '../supabase/functions/xoxo-reveal-upload/recipient-bound-service.mjs';
const senderId='11111111-1111-4111-8111-111111111111',recipientId='22222222-2222-4222-8222-222222222222';
const attemptId='33333333-3333-4333-8333-333333333333',ownerToken='44444444-4444-4444-8444-444444444444';
const revealId='55555555-5555-4555-8555-555555555555',dmId='66666666-6666-4666-8666-666666666666';
const bytes=Uint8Array.from([82,73,70,70,0,0,0,0,87,69,66,80,1,2,3]);
const input={authorization:'Bearer valid.token',recipientId,requestKey:'stable_request_key_123',bytes,claimedType:'image/webp',mode:'once'};
const authClient={auth:{getUser:async()=>({data:{user:{id:senderId}},error:null})}};
test('composition authenticates, claims, seals and creates DM in that order',async()=>{
 const calls=[];
 const rpcClient={rpc:async(name,args)=>{
  calls.push(name);
  if(name==='xoxo_reveal_claim_upload_v2')return {data:{action:'claimed',attempt_id:attemptId,owner_token:ownerToken},error:null};
  if(name==='xoxo_reveal_create_linked_dm_v1')return {data:{reveal_id:revealId,dm_id:dmId},error:null};
  throw Error('Unexpected RPC');
 }};
 const process=createRecipientBoundRevealService({authClient,rpcClient,digest:webcrypto.subtle,
  prepareSealedUpload:async args=>{
   calls.push('sealed');
   assert.deepEqual(args.bytes,bytes);
   assert.equal(args.mime,'image/webp');
   return {attemptId,senderId,recipientId,payloadFingerprint:args.payloadFingerprint,
    writerState:'sealed',uploadUncertain:false,objectPath:'private/sealed.webp'};
  }});
 const result=await process(input);
 assert.deepEqual(result,{action:'delivered',revealId,dmId});
 assert.deepEqual(calls,['xoxo_reveal_claim_upload_v2','sealed','xoxo_reveal_create_linked_dm_v1']);
});
test('composition requires trusted seal and rejects bad media before any RPC',async()=>{
 const rpcClient={rpc:async()=>{throw Error('should not call RPC');}};
 assert.throws(()=>createRecipientBoundRevealService({authClient,rpcClient,digest:webcrypto.subtle}),/Trusted sealed upload required/);
 const process=createRecipientBoundRevealService({authClient,rpcClient,digest:webcrypto.subtle,prepareSealedUpload:async()=>{throw Error('should not seal');}});
 await assert.rejects(process({...input,claimedType:'image/png'}),/Unsupported or oversized media/);
});
