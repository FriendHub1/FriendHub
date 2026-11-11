import test from 'node:test';
import assert from 'node:assert/strict';
import {createRevealReconciliationReviewService} from '../supabase/functions/xoxo-reveal-upload/reconciliation-review-service.mjs';
function make(overrides={}){
 return createRevealReconciliationReviewService({
  authorizeReviewer:async()=>true,
  readAttempt:async()=>({id:'a',sender_id:'s',status:'pending',upload_uncertain_at:'now'}),
  readObjectBinding:async()=>({attemptId:'a',senderId:'s'}),
  readStorageEvidence:async()=>({state:'unavailable'}),
  ...overrides
 });
}
test('attempt database failure does not leak raw error',async()=>{
 const review=make({readAttempt:async()=>{throw Error('database details');}});
 await assert.rejects(()=>review({attemptId:'a',reviewerId:'admin'}),/Reconciliation evidence unavailable/);
});
test('binding lookup failure cannot return a partial review',async()=>{
 const review=make({readObjectBinding:async()=>{throw Error('private path');}});
 await assert.rejects(()=>review({attemptId:'a',reviewerId:'admin'}),/Reconciliation evidence unavailable/);
});
test('Storage evidence failure cannot return a partial review',async()=>{
 const review=make({readStorageEvidence:async()=>{throw Error('private object');}});
 await assert.rejects(()=>review({attemptId:'a',reviewerId:'admin'}),/Reconciliation evidence unavailable/);
});
