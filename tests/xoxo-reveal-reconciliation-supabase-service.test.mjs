import test from 'node:test';
import assert from 'node:assert/strict';
import {createRevealReconciliationSupabaseService} from '../supabase/functions/xoxo-reveal-upload/reconciliation-supabase-service.mjs';
const fingerprint='b'.repeat(64);
function db(calls){
 return {from(table){
  calls.push(table);
  const query={select(){return query;},eq(){return query;},
   async maybeSingle(){
    return {error:null,data:table==='xoxo_reveal_upload_attempts'?
     {id:'a',sender_id:'s',status:'pending',upload_uncertain_at:'now'}:
     {attempt_id:'a',sender_id:'s',bucket_id:'xoxo-reveal',object_path:'a/photo.webp',expected_sha256:'c'.repeat(64)}};
   }};
  return query;
 }};
}
test('unauthorized review does not query Supabase or Storage',async()=>{
 const calls=[];
 const review=createRevealReconciliationSupabaseService({
  supabase:db(calls),authorizeReviewer:async()=>false,
  readTrustedFingerprint:async()=>{throw Error('unexpected');},
  readIntegrity:async()=>{throw Error('unexpected');}
 });
 await assert.rejects(()=>review({attemptId:'a',reviewerId:'other'}),/not authorized/);
 assert.deepEqual(calls,[]);
});
test('authorized review checks private digest and still requires manual resolution',async()=>{
 const calls=[];
 const review=createRevealReconciliationSupabaseService({
  supabase:db(calls),authorizeReviewer:async()=>true,
  readTrustedFingerprint:async()=>fingerprint,
  readIntegrity:async()=>({authoritative:true,objectPath:'a/photo.webp',
   payloadFingerprint:fingerprint,exists:true,digestVerified:true})
 });
 assert.deepEqual(await review({attemptId:'a',reviewerId:'admin'}),{
  action:'manual_review',reason:'integrity_or_writer_unverified'
 });
 assert.deepEqual(calls,['xoxo_reveal_upload_attempts','xoxo_reveal_upload_objects']);
});
test('unavailable private bytes never unlock recovery',async()=>{
 const review=createRevealReconciliationSupabaseService({
  supabase:db([]),authorizeReviewer:async()=>true,
  readTrustedFingerprint:async()=>fingerprint,
  readIntegrity:async()=>{throw Error('Storage unavailable');}
 });
 assert.equal((await review({attemptId:'a',reviewerId:'admin'})).action,'manual_review');
});
