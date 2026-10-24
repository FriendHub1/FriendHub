import test from 'node:test';
import assert from 'node:assert/strict';
import {createRevealReconciliationReviewService} from '../supabase/functions/xoxo-reveal-upload/reconciliation-review-service.mjs';

test('missing attempt requires a second authorization check',async()=>{
 let checks=0,objectReads=0;
 const review=createRevealReconciliationReviewService({
  readAttempt:async()=>null,
  readObjectBinding:async()=>{objectReads++;},
  readStorageEvidence:async()=>{objectReads++;},
  authorizeReviewer:async()=>++checks===1
 });
 await assert.rejects(review({attemptId:'attempt',reviewerId:'reviewer'}),/authorization expired/);
 assert.equal(checks,2);
 assert.equal(objectReads,0);
});
test('authorized missing attempt stays manual-review-only',async()=>{
 let checks=0;
 const review=createRevealReconciliationReviewService({
  readAttempt:async()=>null,
  readObjectBinding:async()=>{throw new Error('unexpected private read');},
  readStorageEvidence:async()=>{throw new Error('unexpected private read');},
  authorizeReviewer:async()=>{checks++;return true;}
 });
 assert.deepEqual(await review({attemptId:'attempt',reviewerId:'reviewer'}),{
  action:'manual_review',reason:'missing_attempt'
 });
 assert.equal(checks,2);
});
test('authorization exception on second check fails closed',async()=>{
 let checks=0;
 const review=createRevealReconciliationReviewService({
  readAttempt:async()=>({id:'other'}),
  readObjectBinding:async()=>{},
  readStorageEvidence:async()=>{},
  authorizeReviewer:async()=>{if(++checks===2)throw new Error('auth outage');return true;}
 });
 await assert.rejects(review({attemptId:'attempt',reviewerId:'reviewer'}),/authorization expired/);
});
