import test from 'node:test';
import assert from 'node:assert/strict';
import {createRevealTrustedQuotaReader} from '../supabase/functions/xoxo-reveal-upload/trusted-quota-supabase-reader.mjs';
const ctx={attemptId:'a',senderId:'s'};
const valid={id:'q',upload_attempt_id:'a',sender_id:'s',byte_count:100,released_at:null};
function setup(row=valid,error=null){
 const calls=[];
 const query={select:fields=>{calls.push(['select',fields]);return query;},eq:(key,value)=>{calls.push(['eq',key,value]);return query;},maybeSingle:async()=>({data:row,error})};
 return {read:createRevealTrustedQuotaReader({dbClient:{from:table=>{calls.push(['from',table]);return query;}}}),calls};
}
test('active quota matches attempt and sender',async()=>{
 const {read,calls}=setup();
 assert.deepEqual(await read(ctx),{authoritative:true,attemptId:'a',senderId:'s',active:true});
 assert.deepEqual(calls[0],['from','xoxo_reveal_quota_reservations']);
});
test('released quota cannot be treated as active',async()=>{
 const {read}=setup({...valid,released_at:'2026-10-19T00:00:00Z'});
 assert.equal((await read(ctx)).active,false);
});
test('mismatched sender, attempt, and invalid byte count fail closed',async()=>{
 for(const patch of [{sender_id:'other'},{upload_attempt_id:'other'},{byte_count:0},{byte_count:15728641},{byte_count:null}]){
  const {read}=setup({...valid,...patch});
  await assert.rejects(()=>read(ctx),/unavailable/);
 }
});
test('missing reservation and database errors fail closed',async()=>{
 for(const [row,error] of [[null,null],[null,{message:'permission denied'}]]){
  const {read}=setup(row,error);
  await assert.rejects(()=>read(ctx),/unavailable/);
 }
});
test('invalid identifiers never reach Supabase',async()=>{
 const {read,calls}=setup();
 await assert.rejects(()=>read({attemptId:'',senderId:'s'}),/Invalid quota/);
 assert.deepEqual(calls,[]);
});
