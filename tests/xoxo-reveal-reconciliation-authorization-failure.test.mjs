import test from 'node:test';
import assert from 'node:assert/strict';
import {createRevealReconciliationReviewService} from '../supabase/functions/xoxo-reveal-upload/reconciliation-review-service.mjs';

for(const failingCheckpoint of [1,2,3]){
 test('reconciliation fails closed when authorization throws at checkpoint '+failingCheckpoint,async()=>{
  let calls=0,attemptReads=0,bindingReads=0,storageReads=0;
  const review=createRevealReconciliationReviewService({
   authorizeReviewer:async()=>{calls++;if(calls===failingCheckpoint)throw new Error('Auth provider unavailable');return true;},
   readAttempt:async()=>{attemptReads++;return {id:'attempt-1',sender_id:'sender-1'};},
   readObjectBinding:async()=>{bindingReads++;return {object_path:'private/test'};},
   readStorageEvidence:async()=>{storageReads++;return {exists:true};}
  });
  await assert.rejects(review({attemptId:'attempt-1',reviewerId:'admin-1',accessToken:'token'}),/Reviewer not authorized|Reviewer authorization expired/);
  assert.equal(calls,failingCheckpoint);
  assert.equal(attemptReads,failingCheckpoint>=2?1:0);
  assert.equal(bindingReads,failingCheckpoint>=3?1:0);
  assert.equal(storageReads,failingCheckpoint>=3?1:0);
 });
}
