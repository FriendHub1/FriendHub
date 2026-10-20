import test from 'node:test';
import assert from 'node:assert/strict';
import {createRecipientBoundHttpHandler} from '../supabase/functions/xoxo-reveal-upload/recipient-bound-http-handler.mjs';
const origin='https://xoxoavenue.com';
const recipient='22222222-2222-4222-8222-222222222222';
const bytes=Uint8Array.from([82,73,70,70,0,0,0,0,87,69,66,80,1,2,3]);
const headers={'origin':origin,'authorization':'Bearer valid.token','content-type':'image/webp',
 'x-reveal-recipient':recipient,'x-reveal-request-key':'stable_request_key_123',
 'x-reveal-mode':'once'};
const request=(override={})=>new Request(origin+'/reveal',{method:'POST',headers:{...headers,...override},body:bytes});
test('trusted pipeline receives bounded bytes and stable idempotency key',async()=>{
 let args;
 const handle=createRecipientBoundHttpHandler({allowedOrigin:origin,processRecipientBoundRequest:async x=>{
  args=x;return {action:'pending'};
 }});
 const response=await handle(request());
 assert.equal(response.status,202);
 assert.equal(args.requestKey,'stable_request_key_123');
 assert.equal(args.recipientId,recipient);
 assert.deepEqual(args.bytes,bytes);
 assert.deepEqual(await response.json(),{action:'pending'});
});
test('malformed request key is rejected before reading or invoking pipeline',async()=>{
 let calls=0;
 const handle=createRecipientBoundHttpHandler({allowedOrigin:origin,processRecipientBoundRequest:async()=>{calls++;}});
 const response=await handle(request({'x-reveal-request-key':'short'}));
 assert.equal(response.status,400);assert.equal(calls,0);
});
test('cross-origin request never reaches trusted pipeline',async()=>{
 let calls=0;
 const handle=createRecipientBoundHttpHandler({allowedOrigin:origin,processRecipientBoundRequest:async()=>{calls++;}});
 const response=await handle(request({origin:'https://attacker.invalid'}));
 assert.equal(response.status,403);assert.equal(calls,0);
 assert.equal(response.headers.get('access-control-allow-origin'),null);
});
test('delivery and replay return distinct statuses without exposing paths',async()=>{
 for(const [action,status] of [['delivered',201],['already_delivered',200],['rejected',409],['needs_reconciliation',503]]){
  const handle=createRecipientBoundHttpHandler({allowedOrigin:origin,processRecipientBoundRequest:async()=>({
   action,revealId:'55555555-5555-4555-8555-555555555555',dmId:'66666666-6666-4666-8666-666666666666',objectPath:'secret'
  })});
  const response=await handle(request());
  assert.equal(response.status,status);
  assert.doesNotMatch(await response.text(),/secret/);
 }
});
test('pipeline failures return generic error without leaking backend details',async()=>{
 const handle=createRecipientBoundHttpHandler({allowedOrigin:origin,processRecipientBoundRequest:async()=>{throw Error('private-token-secret');}});
 const response=await handle(request());
 assert.equal(response.status,503);
 assert.doesNotMatch(await response.text(),/private-token-secret/);
});

test('invalid UUID-shaped recipient is rejected before trusted pipeline',async()=>{
 let calls=0;
 const handle=createRecipientBoundHttpHandler({allowedOrigin:origin,processRecipientBoundRequest:async()=>{calls++;}});
 for(const invalid of ['zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz','22222222-2222-0222-0222-222222222222','22222222-2222-4222-8222-22222222222-']){
  const response=await handle(request({'x-reveal-recipient':invalid}));
  assert.equal(response.status,400);
 }
 assert.equal(calls,0);
});
