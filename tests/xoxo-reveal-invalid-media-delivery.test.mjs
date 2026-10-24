import test from 'node:test';
import assert from 'node:assert/strict';
import {createRecipientBoundRequestAdapter} from '../supabase/functions/xoxo-reveal-upload/recipient-bound-request-adapter.mjs';

test('malformed WebP is rejected before delivery',async()=>{
 let deliveries=0;
 const authClient={auth:{getUser:async()=>({data:{user:{id:'11111111-1111-4111-8111-111111111111'}},error:null})}};
 const adapter=createRecipientBoundRequestAdapter({authClient,deliverReveal:async()=>{deliveries++;return {action:'delivered'};},digest:{digest:async()=>new Uint8Array(32).buffer}});
 await assert.rejects(adapter({authorization:'Bearer test',recipientId:'22222222-2222-4222-8222-222222222222',requestKey:'test_request_key_123456',bytes:new Uint8Array([0,1,2,3,4,5,6,7]),claimedType:'image/webp',mode:'once'}));
 assert.equal(deliveries,0);
});
