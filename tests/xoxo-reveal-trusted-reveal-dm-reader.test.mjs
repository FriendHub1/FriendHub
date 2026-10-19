import test from 'node:test';
import assert from 'node:assert/strict';
import {createRevealTrustedRevealDmReader} from '../supabase/functions/xoxo-reveal-upload/trusted-reveal-dm-supabase-reader.mjs';
const ctx={attemptId:'a',revealId:'r',dmId:'d'};
const reveal={id:'r',dm_id:'d',upload_attempt_id:'a',sender_id:'s',recipient_id:'t',object_path:'a/photo.webp',payload_fingerprint:'f'.repeat(64)};
const dm={id:'d',sender_id:'s',recipient_id:'t'};
function setup(r=reveal,d=dm,authorized=true){
 const calls=[];
 const query=table=>({
  select:()=>query(table),
  eq:()=>query(table),
  maybeSingle:async()=>({data:table==='xoxo_reveals'?r:d,error:null})
 });
 const reader=createRevealTrustedRevealDmReader({
  dbClient:{from:table=>{calls.push(table);return query(table);}},
  verifyDmAuthorization:async()=>{calls.push('authorization');return authorized;}
 });
 return {reader,calls};
}
test('matches Reveal and DM with independent authorization',async()=>{
 const {reader,calls}=setup();
 assert.deepEqual(await reader(ctx),{authoritative:true,attemptId:'a',revealId:'r',dmId:'d',senderId:'s',objectPath:reveal.object_path,payloadFingerprint:reveal.payload_fingerprint,authorizedAtLink:true,recipientMatches:true});
 assert.deepEqual(calls,['xoxo_reveals','direct_messages','authorization']);
});
test('wrong sender, recipient, attempt or fingerprint fails closed',async()=>{
 for(const [r,d] of [
  [reveal,{...dm,sender_id:'other'}],
  [reveal,{...dm,recipient_id:'other'}],
  [{...reveal,upload_attempt_id:'other'},dm],
  [{...reveal,payload_fingerprint:'invalid'},dm]
 ]){
  const {reader}=setup(r,d);
  await assert.rejects(()=>reader(ctx),/unavailable/);
 }
});
test('revoked DM permission rejects matching records',async()=>{
 const {reader}=setup(reveal,dm,false);
 await assert.rejects(()=>reader(ctx),/authorization unavailable/);
});
test('missing records and malformed context fail closed',async()=>{
 const {reader}=setup(null,dm);
 await assert.rejects(()=>reader(ctx),/binding unavailable/);
 await assert.rejects(()=>reader({...ctx,dmId:''}),/Invalid Reveal DM/);
});
