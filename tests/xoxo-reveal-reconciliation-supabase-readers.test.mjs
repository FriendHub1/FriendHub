import test from 'node:test';
import assert from 'node:assert/strict';
import {createRevealReconciliationSupabaseReaders} from '../supabase/functions/xoxo-reveal-upload/reconciliation-supabase-readers.mjs';
function client(rows,error=null){
 const calls=[];
 return {calls,from(table){
  calls.push(['from',table]);
  const q={select(fields){calls.push(['select',fields]);return q;},
   eq(key,value){calls.push(['eq',key,value]);return q;},
   async maybeSingle(){return {data:rows[table]??null,error};}};
  return q;
 }};
}
test('attempt evidence comes from exact attempt row',async()=>{
 const db=client({xoxo_reveal_upload_attempts:{id:'a',sender_id:'s',status:'pending',upload_uncertain_at:'now'}});
 const reader=createRevealReconciliationSupabaseReaders({supabase:db});
 assert.equal((await reader.readAttempt({attemptId:'a'})).sender_id,'s');
 assert.deepEqual(db.calls.filter(x=>x[0]==='eq'),[['eq','id','a']]);
});
test('binding is scoped by attempt and sender and normalized',async()=>{
 const db=client({xoxo_reveal_upload_objects:{attempt_id:'a',sender_id:'s',bucket_id:'xoxo-reveal',object_path:'a/o',expected_sha256:'a'.repeat(64)}});
 const reader=createRevealReconciliationSupabaseReaders({supabase:db});
 assert.equal((await reader.readObjectBinding({attemptId:'a',senderId:'s'})).expectedSha256,'a'.repeat(64));
 assert.deepEqual(db.calls.filter(x=>x[0]==='eq'),[['eq','attempt_id','a'],['eq','sender_id','s']]);
});
test('database errors fail closed',async()=>{
 const reader=createRevealReconciliationSupabaseReaders({supabase:client({}, {message:'down'})});
 await assert.rejects(()=>reader.readAttempt({attemptId:'a'}),/unavailable/);
});
