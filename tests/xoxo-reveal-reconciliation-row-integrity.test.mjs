import test from 'node:test';
import assert from 'node:assert/strict';
import {createRevealReconciliationSupabaseReaders} from '../supabase/functions/xoxo-reveal-upload/reconciliation-supabase-readers.mjs';
function client(row){
 return {from:()=>({select:()=>({eq(){return this;},maybeSingle:async()=>({data:row,error:null})})})};
}
test('attempt reconciliation rejects a mismatched database row',async()=>{
 const read=createRevealReconciliationSupabaseReaders({supabase:client({id:'other',sender_id:'sender'})});
 await assert.rejects(read.readAttempt({attemptId:'attempt'}),/Reconciliation evidence unavailable/);
});
test('object reconciliation rejects mismatched and unsafe persisted rows',async()=>{
 const base={attempt_id:'attempt',sender_id:'sender',bucket_id:'xoxo-reveal',
  object_path:'private/object',expected_sha256:'a'.repeat(64)};
 for(const row of [
  {...base,attempt_id:'other'}, {...base,sender_id:'other'},
  {...base,bucket_id:'public'}, {...base,object_path:'../escape'},
  {...base,object_path:'  '}, {...base,expected_sha256:'untrusted'}
 ]){
  const read=createRevealReconciliationSupabaseReaders({supabase:client(row)});
  await assert.rejects(read.readObjectBinding({attemptId:'attempt',senderId:'sender'}),/Reconciliation evidence unavailable/);
 }
});
test('valid reconciliation binding remains available for manual review',async()=>{
 const row={attempt_id:'attempt',sender_id:'sender',bucket_id:'xoxo-reveal',
  object_path:'private/object',expected_sha256:'a'.repeat(64)};
 const read=createRevealReconciliationSupabaseReaders({supabase:client(row)});
 assert.deepEqual(await read.readObjectBinding({attemptId:'attempt',senderId:'sender'}),{
  attemptId:'attempt',senderId:'sender',bucketId:'xoxo-reveal',
  objectPath:'private/object',expectedSha256:'a'.repeat(64)
 });
});
