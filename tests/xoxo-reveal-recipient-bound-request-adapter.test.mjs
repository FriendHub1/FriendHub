import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {createRecipientBoundRequestAdapter} from '../supabase/functions/xoxo-reveal-upload/recipient-bound-request-adapter.mjs';
const senderId='11111111-1111-4111-8111-111111111111',recipientId='22222222-2222-4222-8222-222222222222';
const authClient={auth:{getUser:async token=>({data:{user:{id:senderId}},error:null})}};
const bytes=Uint8Array.from([82,73,70,70,0,0,0,0,87,69,66,80,1,2,3]);
const input={authorization:'Bearer valid.token',recipientId,requestKey:'stable_request_key_123',bytes,claimedType:'image/webp',mode:'once'};
test('authenticates and hashes verified bytes before calling delivery coordinator',async()=>{
 let args;
 const process=createRecipientBoundRequestAdapter({authClient,digest:webcrypto.subtle,deliverReveal:async x=>{args=x;return {action:'pending'};}});
 assert.deepEqual(await process(input),{action:'pending'});
 assert.equal(args.senderId,senderId);
 assert.equal(args.recipientId,recipientId);
 assert.equal(args.mediaType,'image');
 assert.equal(args.mime,'image/webp');
 assert.equal(args.bytes,bytes);
 assert.match(args.payloadFingerprint,/^[0-9a-f]{64}$/);
 const expected=Buffer.from(await webcrypto.subtle.digest('SHA-256',bytes)).toString('hex');
 assert.equal(args.payloadFingerprint,expected);
});
test('unauthenticated, malformed or invalid media never reaches delivery',async()=>{
 let deliveries=0;
 const process=createRecipientBoundRequestAdapter({authClient,digest:webcrypto.subtle,deliverReveal:async()=>{deliveries++;}});
 for(const change of [{authorization:'bad'},{claimedType:'image/png'},{recipientId:senderId},{requestKey:'short'}]){
  await assert.rejects(process({...input,...change}));
 }
 assert.equal(deliveries,0);
});
test('different media bytes produce different retry fingerprints',async()=>{
 const hashes=[];
 const process=createRecipientBoundRequestAdapter({authClient,digest:webcrypto.subtle,deliverReveal:async x=>{hashes.push(x.payloadFingerprint);return {action:'pending'};}});
 await process(input);
 await process({...input,bytes:Uint8Array.from([...bytes,4])});
 assert.notEqual(hashes[0],hashes[1]);
});

test('invalid digest never reaches delivery',async()=>{
 let calls=0;
 const process=createRecipientBoundRequestAdapter({authClient,digest:{digest:async()=>new Uint8Array([1,2,3]).buffer},deliverReveal:async()=>{calls++;}});
 await assert.rejects(process(input),/Invalid server digest/);
 assert.equal(calls,0);
});

test('hash and delivered bytes use an immutable snapshot when caller mutates original',async()=>{
 const source=Uint8Array.from(bytes);
 let release;
 const gate=new Promise(resolve=>{release=resolve;});
 let received;
 const digest={digest:async(algorithm,snapshot)=>{
  await gate;
  return webcrypto.subtle.digest(algorithm,snapshot);
 }};
 const process=createRecipientBoundRequestAdapter({authClient,digest,deliverReveal:async args=>{received=args;return {action:'pending'};}});
 const pending=process({...input,bytes:source});
 // Allow authentication and validation to reach the digest before mutation.
 await new Promise(resolve=>setImmediate(resolve));
 source[source.length-1]^=255;
 release();
 await pending;
 assert.notEqual(received.bytes,source);
 assert.equal(received.bytes[received.bytes.length-1],bytes[bytes.length-1]);
 const expected=Buffer.from(await webcrypto.subtle.digest('SHA-256',bytes)).toString('hex');
 assert.equal(received.payloadFingerprint,expected);
});
