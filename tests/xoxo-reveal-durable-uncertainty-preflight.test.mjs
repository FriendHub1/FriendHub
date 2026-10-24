import test from 'node:test';
import assert from 'node:assert/strict';
import {createRevealDurableUncertaintyPreflight} from '../supabase/functions/xoxo-reveal-upload/durable-uncertainty-preflight.mjs';
const input={attemptId:'a',senderId:'s'};
test('fresh instance refuses persisted uncertainty before any remote write',async()=>{
 let uploads=0;
 const guard=createRevealDurableUncertaintyPreflight({
  readAttempt:async()=>({id:'a',sender_id:'s',status:'pending',upload_uncertain_at:'2026-10-19T00:00:00Z'}),
  uploadAndSeal:async()=>{uploads++;return {sealed:true};}
 });
 await assert.rejects(guard(input),/reconciliation required/);
 assert.equal(uploads,0);
});
test('preflight fails closed on missing, mismatched, completed or unreadable attempt',async()=>{
 for(const row of [null,{id:'a',sender_id:'other',status:'pending',upload_uncertain_at:null},
  {id:'a',sender_id:'s',status:'completed',upload_uncertain_at:null}]){
  const guard=createRevealDurableUncertaintyPreflight({
   readAttempt:async()=>row,uploadAndSeal:async()=>{throw Error('unexpected upload');}
  });
  await assert.rejects(guard(input),/reconciliation required/);
 }
 const guard=createRevealDurableUncertaintyPreflight({
  readAttempt:async()=>{throw Error('database offline');},
  uploadAndSeal:async()=>{throw Error('unexpected upload');}
 });
 await assert.rejects(guard(input),/preflight unavailable/);
});
test('matching pending attempt without uncertainty proceeds to existing writer guard',async()=>{
 let uploads=0;
 const guard=createRevealDurableUncertaintyPreflight({
  readAttempt:async()=>({id:'a',sender_id:'s',status:'pending',upload_uncertain_at:null}),
  uploadAndSeal:async()=>{uploads++;return {sealed:true};}
 });
 assert.deepEqual(await guard(input),{sealed:true});
 assert.equal(uploads,1);
});
