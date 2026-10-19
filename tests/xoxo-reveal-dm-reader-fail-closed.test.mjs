import test from 'node:test';
import assert from 'node:assert/strict';
import {createRevealTrustedRevealDmReader} from '../supabase/functions/xoxo-reveal-upload/trusted-reveal-dm-supabase-reader.mjs';
const input={attemptId:'attempt',revealId:'reveal',dmId:'dm'};
const reveal={id:'reveal',dm_id:'dm',upload_attempt_id:'attempt',sender_id:'sender',recipient_id:'recipient',object_path:'private/a',payload_fingerprint:'a'.repeat(64)};
const dm={id:'dm',sender_id:'sender',recipient_id:'recipient'};
const client=(stage)=>({from(table){
 if(stage==='reveal'&&table==='xoxo_reveals')throw Error('private db details');
 if(stage==='dm'&&table==='direct_messages')throw Error('private db details');
 return {select(){return this;},eq(){return this;},async maybeSingle(){return {data:table==='xoxo_reveals'?reveal:dm,error:null};}};
}});
for(const stage of ['reveal','dm','authorization']){
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
