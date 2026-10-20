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

test('same request key with changed media is rejected by claim and never writes',async()=>{
 const seen=new Map();
 let writes=0,links=0;
 const rpcClient={rpc:async(name,args)=>{
  if(name==='xoxo_reveal_claim_upload_v2'){
   const key=args.p_request_key,fp=args.p_payload_fingerprint;
   if(seen.has(key)&&seen.get(key)!==fp)
    return {data:{action:'reject',attempt_id:attempt}};
   seen.set(key,fp);
   return {data:{action:'claimed',attempt_id:attempt,owner_token:owner}};
  }
  links++;
  return {data:{reveal_id:reveal,dm_id:dm}};
 }};
 const pipeline=createRecipientBoundPipeline({authClient,rpcClient,digest:webcrypto.subtle,
  prepareSealedUpload:async args=>{
   writes++;
   return {attemptId:attempt,senderId:sender,recipientId:recipient,
    payloadFingerprint:args.payloadFingerprint,objectPath:'private/test.webp',
    writerState:'sealed',uploadUncertain:false};
  }});
 assert.equal((await pipeline(input)).action,'delivered');
 const changed=Uint8Array.from([...bytes,99]);
 assert.deepEqual(await pipeline({...input,bytes:changed}),{action:'rejected'});
 assert.equal(writes,1);
 assert.equal(links,1);
});

test('atomic RPC error after sealed Storage never reports success or retries writing',async()=>{
 const calls=[];
 const rpcClient={rpc:async name=>{
  calls.push(name);
  if(name==='xoxo_reveal_claim_upload_v2')
   return {data:{action:'claimed',attempt_id:attempt,owner_token:owner}};
  return {error:{message:'simulated transaction rollback'}};
 }};
 const pipeline=createRecipientBoundPipeline({authClient,rpcClient,digest:webcrypto.subtle,
  prepareSealedUpload:async args=>{
   calls.push('seal');
   return {attemptId:attempt,senderId:sender,recipientId:recipient,
    payloadFingerprint:args.payloadFingerprint,objectPath:'private/test.webp',
    writerState:'sealed',uploadUncertain:false};
  }});
 await assert.rejects(pipeline(input),/Atomic Reveal message creation unavailable/);
 assert.deepEqual(calls,['xoxo_reveal_claim_upload_v2','seal','xoxo_reveal_create_linked_dm_v1']);
});

test('atomic RPC failure after sealing never reports delivery or retries Storage',async()=>{
 const calls=[];
 const rpcClient={rpc:async name=>{
  calls.push(name);
  if(name==='xoxo_reveal_claim_upload_v2')
   return {data:{action:'claimed',attempt_id:attempt,owner_token:owner}};
  throw new Error('database unavailable');
 }};
 const pipeline=createRecipientBoundPipeline({authClient,rpcClient,digest:webcrypto.subtle,
  prepareSealedUpload:async args=>{
   calls.push('seal');
   return {attemptId:attempt,senderId:sender,recipientId:recipient,
    payloadFingerprint:args.payloadFingerprint,objectPath:'private/test.webp',
    writerState:'sealed',uploadUncertain:false};
  }});
 await assert.rejects(pipeline(input),/Atomic Reveal message creation unavailable/);
 assert.deepEqual(calls,['xoxo_reveal_claim_upload_v2','seal','xoxo_reveal_create_linked_dm_v1']);
});

test('concurrent duplicate requests write and link only once when claim reports wait',async()=>{
 let claimCount=0,writes=0,links=0,releaseWriter;
 const writerGate=new Promise(resolve=>{releaseWriter=resolve;});
 const rpcClient={rpc:async(name)=>{
  if(name==='xoxo_reveal_claim_upload_v2'){
   claimCount++;
   return {data:claimCount===1
    ?{action:'claimed',attempt_id:attempt,owner_token:owner}
    :{action:'wait',attempt_id:attempt}};
  }
  links++;
  return {data:{reveal_id:reveal,dm_id:dm}};
 }};
 let signalWriting;
 const writing=new Promise(resolve=>{signalWriting=resolve;});
 const pipeline=createRecipientBoundPipeline({authClient,rpcClient,digest:webcrypto.subtle,
  prepareSealedUpload:async args=>{
   writes++;signalWriting();await writerGate;
   return {attemptId:attempt,senderId:sender,recipientId:recipient,
    payloadFingerprint:args.payloadFingerprint,objectPath:'private/test.webp',
    writerState:'sealed',uploadUncertain:false};
  }});
 const first=pipeline(input);
 await writing;
 const duplicate=await pipeline(input);
 assert.deepEqual(duplicate,{action:'pending'});
 assert.equal(writes,1);
 assert.equal(links,0);
 releaseWriter();
 assert.deepEqual(await first,{action:'delivered',revealId:reveal,dmId:dm});
 assert.equal(writes,1);
 assert.equal(links,1);
});

test('recipient-bound idempotency rejects replay to a different recipient without Storage writes',async()=>{
 const fingerprints=new Map();
 let writes=0,links=0;
 const rpcClient={rpc:async(name,args)=>{
  if(name==='xoxo_reveal_claim_upload_v2'){
   const key=args.p_request_key;
   const previous=fingerprints.get(key);
   if(previous && (previous.recipient!==args.p_recipient_id||previous.fingerprint!==args.p_payload_fingerprint))
    return {data:{action:'reject',attempt_id:attempt}};
   fingerprints.set(key,{recipient:args.p_recipient_id,fingerprint:args.p_payload_fingerprint});
   return {data:{action:'claimed',attempt_id:attempt,owner_token:owner}};
  }
  links++;
  return {data:{reveal_id:reveal,dm_id:dm}};
 }};
 const pipeline=createRecipientBoundPipeline({authClient,rpcClient,digest:webcrypto.subtle,
  prepareSealedUpload:async args=>{
   writes++;
   return {attemptId:attempt,senderId:sender,recipientId:args.recipientId,
    payloadFingerprint:args.payloadFingerprint,objectPath:'private/test.webp',
    writerState:'sealed',uploadUncertain:false};
  }});
 assert.equal((await pipeline(input)).action,'delivered');
 const secondRecipient='77777777-7777-4777-8777-777777777777';
 assert.deepEqual(await pipeline({...input,recipientId:secondRecipient}),{action:'rejected'});
 assert.equal(writes,1);
 assert.equal(links,1);
});

test('cross-recipient replay cannot reuse sealed media or insert a DM',async()=>{
 const calls=[];
 const otherRecipient='77777777-7777-4777-8777-777777777777';
 const rpcClient={rpc:async(name,args)=>{
  calls.push(name);
  if(name==='xoxo_reveal_claim_upload_v2'){
   assert.equal(args.p_recipient_id,otherRecipient);
   return {data:{action:'claimed',attempt_id:attempt,owner_token:owner}};
  }
  throw Error('DM must never be created');
 }};
 const pipeline=createRecipientBoundPipeline({authClient,rpcClient,digest:webcrypto.subtle,
  prepareSealedUpload:async args=>({
   attemptId:attempt,senderId:sender,recipientId:recipient,
   payloadFingerprint:args.payloadFingerprint,objectPath:'private/test.webp',
   writerState:'sealed',uploadUncertain:false
  })});
 await assert.rejects(pipeline({...input,recipientId:otherRecipient}),/Trusted sealed upload required/);
 assert.deepEqual(calls,['xoxo_reveal_claim_upload_v2']);
});

test('server-side byte digest failure cannot create a claim or write media',async()=>{
 let calls=0;
 const pipeline=createRecipientBoundPipeline({authClient,
  rpcClient:{rpc:async()=>{calls++;throw Error('unexpected RPC');}},
  digest:{digest:async()=>{throw Error('SHA-256 unavailable');}},
  prepareSealedUpload:async()=>{calls++;}});
 await assert.rejects(pipeline(input),/SHA-256 unavailable/);
 assert.equal(calls,0);
});
