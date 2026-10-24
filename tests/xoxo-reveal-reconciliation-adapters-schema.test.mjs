import test from 'node:test';
import assert from 'node:assert/strict';
import {createRevealReconciliationReaders} from '../supabase/functions/xoxo-reveal-upload/reconciliation-supabase-adapters.mjs';
const attempt={id:'attempt-1',sender_id:'sender-1',payload_fingerprint:'a'.repeat(64)};
function readers(revealOverrides={}){
 return createRevealReconciliationReaders({
  getRevealAndDmByAttempt:async()=>({
   authoritative:true,state:'present',objectPath:'sender-1/attempt-1.webp',
   reveal:{id:'reveal-1',dm_id:'dm-1',sender_id:'sender-1',
    recipient_id:'recipient-1',upload_attempt_id:'attempt-1',
    payload_fingerprint:'a'.repeat(64),object_path:'sender-1/attempt-1.webp',
    ...revealOverrides},
   dm:{id:'dm-1',sender_id:'sender-1',recipient_id:'recipient-1'}
  }),
  getPrivateObjectByPath:async()=>({authoritative:true,state:'absent'}),
  getQuotaByAttempt:async()=>({authoritative:true,state:'reserved',attemptId:'attempt-1',senderId:'sender-1'})
 });
}
test('accepts exact upload_attempt_id association from review-only schema',async()=>{
 const result=await readers().readLinkedMessage(attempt);
 assert.equal(result.state,'present');
 assert.equal(result.authoritative,true);
});
test('rejects missing or mismatched upload_attempt_id',async()=>{
 for(const value of [undefined,'different-attempt']){
  const result=await readers({upload_attempt_id:value}).readLinkedMessage(attempt);
  assert.equal(result.authoritative,false);
  assert.equal(result.state,'unknown');
 }
});
test('rejects a wrong fingerprint or recipient linkage',async()=>{
 for(const overrides of [{payload_fingerprint:'b'.repeat(64)},{recipient_id:'other'}]){
  const result=await readers(overrides).readLinkedMessage(attempt);
  assert.equal(result.authoritative,false);
 }
});
