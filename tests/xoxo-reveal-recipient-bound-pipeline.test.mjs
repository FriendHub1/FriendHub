import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {createRecipientBoundPipeline} from '../supabase/functions/xoxo-reveal-upload/recipient-bound-pipeline.mjs';

const sender='11111111-1111-4111-8111-111111111111';
const recipient='22222222-2222-4222-8222-222222222222';
const attempt='33333333-3333-4333-8333-333333333333';
const owner='44444444-4444-4444-8444-444444444444';
const reveal='55555555-5555-4555-8555-555555555555';
const dm='66666666-6666-4666-8666-666666666666';
const bytes=Uint8Array.from([82,73,70,70,0,0,0,0,87,69,66,80,1,2,3]);
const input={authorization:'Bearer valid.token',recipientId:recipient,requestKey:'pipeline_request_1234',bytes,claimedType:'image/webp',mode:'once'};
const authClient={auth:{getUser:async()=>({data:{user:{id:sender}},error:null})}};

test('real adapter chain authenticates, claims, seals and atomically creates one DM',async()=>{
 const calls=[];
 let fingerprint;
 const rpcClient={rpc:async(name,args)=>{
  calls.push(name);
  if(name==='xoxo_reveal_claim_upload_v2'){
   assert.equal(args.p_recipient_id,recipient);
   fingerprint=args.p_payload_fingerprint;
   assert.match(fingerprint,/^[a-f0-9]{64}$/);
   return {data:{action:'claimed',attempt_id:attempt,owner_token:owner}};
  }
  assert.equal(name,'xoxo_reveal_create_linked_dm_v1');
  assert.equal(args.p_attempt_id,attempt);
  assert.equal(args.p_claim_token,owner);
  assert.equal(args.p_object_path,'private/test.webp');
  return {data:{reveal_id:reveal,dm_id:dm}};
 }};
 const pipeline=createRecipientBoundPipeline({authClient,rpcClient,digest:webcrypto.subtle,
  prepareSealedUpload:async args=>{
   calls.push('seal');
   assert.deepEqual(args.bytes,bytes);
   assert.equal(args.mime,'image/webp');
   assert.equal(args.payloadFingerprint,fingerprint);
   return {attemptId:attempt,senderId:sender,recipientId:recipient,payloadFingerprint:fingerprint,
    objectPath:'private/test.webp',writerState:'sealed',uploadUncertain:false};
  }});
 assert.deepEqual(await pipeline(input),{action:'delivered',revealId:reveal,dmId:dm});
 assert.deepEqual(calls,['xoxo_reveal_claim_upload_v2','seal','xoxo_reveal_create_linked_dm_v1']);
});

test('idempotent replay never starts Storage or a second linked DM',async()=>{
 let writes=0;
 const rpcClient={rpc:async(name)=>{
  assert.equal(name,'xoxo_reveal_claim_upload_v2');
  return {data:{action:'return_existing',attempt_id:attempt,reveal_id:reveal,dm_id:dm}};
 }};
 const pipeline=createRecipientBoundPipeline({authClient,rpcClient,digest:webcrypto.subtle,
  prepareSealedUpload:async()=>{writes++;throw Error('must not write');}});
 assert.deepEqual(await pipeline(input),{action:'already_delivered',revealId:reveal,dmId:dm});
 assert.equal(writes,0);
});

test('invalid authentication cannot reach privileged RPC or Storage',async()=>{
 let calls=0;
 const rpcClient={rpc:async()=>{calls++;}};
 const pipeline=createRecipientBoundPipeline({authClient,rpcClient,digest:webcrypto.subtle,
  prepareSealedUpload:async()=>{calls++;}});
 await assert.rejects(pipeline({...input,authorization:'invalid'}));
 assert.equal(calls,0);
});

test('composition fails closed without trusted Storage writer',()=>{
 assert.throws(()=>createRecipientBoundPipeline({authClient,rpcClient:{rpc:async()=>{}}}),/Trusted sealed Storage writer required/);
});

test('pending claim through real RPC chain cannot upload or insert DM',async()=>{
 const calls=[];
 const rpcClient={rpc:async name=>{calls.push(name);return {data:{action:'wait',attempt_id:attempt}};}};
 const pipeline=createRecipientBoundPipeline({authClient,rpcClient,digest:webcrypto.subtle,
  prepareSealedUpload:async()=>{calls.push('seal');throw Error('must not write');}});
 assert.deepEqual(await pipeline(input),{action:'pending'});
 assert.deepEqual(calls,['xoxo_reveal_claim_upload_v2']);
});

test('uncertain Storage writer through real RPC chain cannot create DM',async()=>{
 const calls=[];
 const rpcClient={rpc:async name=>{
  calls.push(name);
  if(name!=='xoxo_reveal_claim_upload_v2')throw Error('DM must not be inserted');
  return {data:{action:'claimed',attempt_id:attempt,owner_token:owner}};
 }};
 const pipeline=createRecipientBoundPipeline({authClient,rpcClient,digest:webcrypto.subtle,
  prepareSealedUpload:async args=>({
   attemptId:attempt,senderId:sender,recipientId:recipient,
   payloadFingerprint:args.payloadFingerprint,objectPath:'private/test.webp',
   writerState:'writing',uploadUncertain:true
  })});
 await assert.rejects(pipeline(input),/Trusted sealed upload required/);
 assert.deepEqual(calls,['xoxo_reveal_claim_upload_v2']);
});
