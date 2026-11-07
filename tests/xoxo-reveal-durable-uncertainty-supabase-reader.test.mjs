import test from 'node:test';
import assert from 'node:assert/strict';
import {createRevealDurableUncertaintySupabaseReader} from '../supabase/functions/xoxo-reveal-upload/durable-uncertainty-supabase-reader.mjs';
import {createRevealDurableUncertaintyPreflight} from '../supabase/functions/xoxo-reveal-upload/durable-uncertainty-preflight.mjs';
const identity={attemptId:'attempt',senderId:'sender'};
function mockDb(row,error=null){
 const calls=[];
 const query={
  select(fields){calls.push(['select',fields]);return this;},
  eq(field,value){calls.push(['eq',field,value]);return this;},
  async maybeSingle(){return {data:row,error};}
 };
 return {calls,client:{from(table){calls.push(['from',table]);return query;}}};
}
test('persisted uncertain row blocks Storage in a new service instance',async()=>{
 const db=mockDb({id:'attempt',sender_id:'sender',status:'pending',upload_uncertain_at:'now'});
 let writes=0;
 const upload=createRevealDurableUncertaintyPreflight({
  readAttempt:createRevealDurableUncertaintySupabaseReader({dbClient:db.client}),
  uploadAndSeal:async()=>{writes++;return {sealed:true};}
 });
 await assert.rejects(upload(identity),/reconciliation required/);
 assert.equal(writes,0);
 assert.deepEqual(db.calls.filter(c=>c[0]==='eq'),[['eq','id','attempt'],['eq','sender_id','sender']]);
});
test('privileged reader fails closed on DB errors and mismatched rows',async()=>{
 for(const [row,error] of [
  [{id:'attempt',sender_id:'other',status:'pending',upload_uncertain_at:null},null],
  [{id:'attempt',sender_id:'sender',status:'pending'},null],
  [null,{message:'db unavailable'}]
 ]){
  const db=mockDb(row,error);
  const read=createRevealDurableUncertaintySupabaseReader({dbClient:db.client});
  await assert.rejects(read(identity),/Durable attempt state unavailable/);
 }
});
