import test from "node:test";
import assert from "node:assert/strict";
import {createAtomicRevealMessageAdapter} from "../supabase/functions/xoxo-reveal-upload/transactional-linked-message-adapter.mjs";
const sender="11111111-1111-4111-8111-111111111111";
const recipient="22222222-2222-4222-8222-222222222222";
const base={attemptId:"55555555-5555-4555-8555-555555555555",claimToken:"66666666-6666-4666-8666-666666666666",senderId:sender,recipientId:recipient,objectPath:"sender/attempt/object.webp",mediaType:"image",mode:"once"};
test("uses one trusted RPC to create the linked DM and Reveal atomically",async()=>{
 const calls=[];
 const create=createAtomicRevealMessageAdapter({rpcClient:{rpc:async(name,args)=>{calls.push({name,args});return {data:{reveal_id:"33333333-3333-4333-8333-333333333333",dm_id:"44444444-4444-4444-8444-444444444444"},error:null};}}});
 assert.deepEqual(await create(base),{revealId:"33333333-3333-4333-8333-333333333333",dmId:"44444444-4444-4444-8444-444444444444"});
 assert.equal(calls.length,1);
 assert.equal(calls[0].name,"xoxo_reveal_create_linked_dm_v1");
 assert.equal(calls[0].args.p_attempt_id,base.attemptId);
 assert.equal(calls[0].args.p_claim_token,base.claimToken);
 assert.equal(calls[0].args.p_sender_id,sender);
 assert.equal(calls[0].args.p_recipient_id,recipient);
});
test("rejects invalid participants and unsafe paths before RPC",async()=>{
 let called=false;
 const create=createAtomicRevealMessageAdapter({rpcClient:{rpc:async()=>{called=true;return {data:null,error:null};}}});
 await assert.rejects(create({...base,claimToken:null}),/attempt claim/);
 await assert.rejects(create({...base,senderId:recipient}),/participant IDs/);
 await assert.rejects(create({...base,objectPath:"../private.webp"}),/object path/);
 assert.equal(called,false);
});
test("enforces supported timed duration and rejects unexpected duration for once mode",async()=>{
 const create=createAtomicRevealMessageAdapter({rpcClient:{rpc:async()=>({data:{reveal_id:"33333333-3333-4333-8333-333333333333",dm_id:"44444444-4444-4444-8444-444444444444"},error:null})}});
 await assert.rejects(create({...base,mode:"timed",seconds:30,durationSeconds:30}),/duration/);
 await assert.rejects(create({...base,seconds:5}),/Unexpected Reveal duration/);
});
test("fails closed on RPC errors and malformed linked identifiers",async()=>{
 const failed=createAtomicRevealMessageAdapter({rpcClient:{rpc:async()=>({data:null,error:{message:"database detail"}})}});
 await assert.rejects(failed(base),/unavailable/);
 const malformed=createAtomicRevealMessageAdapter({rpcClient:{rpc:async()=>({data:{reveal_id:"not-id",dm_id:"not-id"},error:null})}});
 await assert.rejects(malformed(base),/invalid identifiers/);
});
