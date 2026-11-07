import test from 'node:test';
import assert from 'node:assert/strict';
import {createRevealTrustedRevealDmReader} from '../supabase/functions/xoxo-reveal-upload/trusted-reveal-dm-supabase-reader.mjs';
const input={attemptId:'11111111-1111-4111-8111-111111111111',revealId:'22222222-2222-4222-8222-222222222222',dmId:'33333333-3333-4333-8333-333333333333'};
const reveal={id:'22222222-2222-4222-8222-222222222222',dm_id:'33333333-3333-4333-8333-333333333333',upload_attempt_id:'11111111-1111-4111-8111-111111111111',sender_id:'sender',recipient_id:'recipient',object_path:'private/a',payload_fingerprint:'11111111-1111-4111-8111-111111111111'.repeat(64)};
const dm={id:'33333333-3333-4333-8333-333333333333',sender_id:'sender',recipient_id:'recipient'};
const client=(stage)=>({from(table){
 if(stage==='22222222-2222-4222-8222-222222222222'&&table==='xoxo_reveals')throw Error('private db details');
 if(stage==='33333333-3333-4333-8333-333333333333'&&table==='direct_messages')throw Error('private db details');
 return {select(){return this;},eq(){return this;},async maybeSingle(){return {data:table==='xoxo_reveals'?reveal:dm,error:null};}};
}});
for(const stage of ['22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333','authorization']){
 test('trusted DM reader fails closed without leaking '+stage+' dependency error',async()=>{
  const read=createRevealTrustedRevealDmReader({
   dbClient:client(stage),
   verifyDmAuthorization:async()=>{if(stage==='authorization')throw Error('private auth details');return true;}
  });
  await assert.rejects(read(input),error=>{
   assert.equal(error.message.includes('private'),false);
   assert.match(error.message,/unavailable/);
   return true;
  });
 });
}

test('DM reader rejects malformed input before database access',async()=>{
 let reads=0;
 const read=createRevealTrustedRevealDmReader({
  dbClient:{from(){reads++;throw Error('unexpected access');}},
  verifyDmAuthorization:async()=>true
 });
 for(const malformed of [null,42,'text',[],{}])
  await assert.rejects(read(malformed),TypeError);
 assert.equal(reads,0);
});
test('DM reader rejects truthy non-string binding fields',async()=>{
 for(const invalidField of ['sender_id','recipient_id','object_path','payload_fingerprint']){
  const bad={...reveal,[invalidField]:{toString(){return '11111111-1111-4111-8111-111111111111'.repeat(64);}}};
  let authorized=0;
  const read=createRevealTrustedRevealDmReader({
   dbClient:{from(table){return {select(){return this;},eq(){return this;},
    async maybeSingle(){return {data:table==='xoxo_reveals'?bad:dm,error:null};}
   };}},
   verifyDmAuthorization:async()=>{authorized++;return true;}
  });
  await assert.rejects(read(input),/Trusted DM binding unavailable/);
  assert.equal(authorized,0);
 }
});

test('DM reader rejects array-shaped persisted rows before authorization',async()=>{
 for(const badTable of ['xoxo_reveals','direct_messages']){
  let authorized=0;
  const read=createRevealTrustedRevealDmReader({
   dbClient:{from(table){return {select(){return this;},eq(){return this;},
    async maybeSingle(){return {data:table===badTable?[]:table==='xoxo_reveals'?reveal:dm,error:null};}
   };}},
   verifyDmAuthorization:async()=>{authorized++;return true;}
  });
  await assert.rejects(read(input),/binding unavailable/);
  assert.equal(authorized,0);
 }
});

test('DM reader rejects unsafe private Storage object paths',async()=>{
 for(const path of ['/private/a','private//a','private/../a','private/./a','private/']){
  let authorized=0;
  const read=createRevealTrustedRevealDmReader({
   dbClient:{from(table){return {select(){return this;},eq(){return this;},
    async maybeSingle(){return {data:table==='xoxo_reveals'?{...reveal,object_path:path}:dm,error:null};}
   };}},
   verifyDmAuthorization:async()=>{authorized++;return true;}
  });
  await assert.rejects(read(input),/Trusted DM binding unavailable/);
  assert.equal(authorized,0);
 }
});
