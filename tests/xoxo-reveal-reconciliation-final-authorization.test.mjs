import test from 'node:test';
import assert from 'node:assert/strict';
import {createRevealReconciliationReviewService} from '../supabase/functions/xoxo-reveal-upload/reconciliation-review-service.mjs';
test('revocation during Storage read blocks returning private findings',async()=>{
 let checks=0;
 const review=createRevealReconciliationReviewService({
  authorizeReviewer:async()=>++checks<3,
  readAttempt:async()=>({id:'a',sender_id:'s',status:'pending',upload_uncertain_at:'now'}),
  readObjectBinding:async()=>({attemptId:'a',senderId:'s'}),
  readStorageEvidence:async()=>({state:'present',digestMatches:true,writerQuiescent:false})
 });
 await assert.rejects(()=>review({attemptId:'a',reviewerId:'admin',accessToken:'token'}),/authorization expired/);
 assert.equal(checks,3);
});
test('valid reviewer passes all three checks and receives manual-only decision',async()=>{
 let checks=0;
 const review=createRevealReconciliationReviewService({
  authorizeReviewer:async()=>{checks++;return true;},
  readAttempt:async()=>({id:'a',sender_id:'s',status:'pending',upload_uncertain_at:'now'}),
  readObjectBinding:async()=>({attemptId:'a',senderId:'s'}),
  readStorageEvidence:async()=>({state:'present',digestMatches:true,writerQuiescent:false})
 });
 assert.equal((await review({attemptId:'a',reviewerId:'admin',accessToken:'token'})).action,'manual_review');
 assert.equal(checks,3);
});
