import test from 'node:test';
import assert from 'node:assert/strict';
import {createRevealReconciliationReviewService} from '../supabase/functions/xoxo-reveal-upload/reconciliation-review-service.mjs';
test('revoked review permission after attempt read prevents private object evidence',async()=>{
 let authorizations=0,privateReads=0;
 const review=createRevealReconciliationReviewService({
  authorizeReviewer:async()=>++authorizations===1,
  readAttempt:async()=>({id:'a',sender_id:'s',upload_uncertain_at:'now'}),
  readObjectBinding:async()=>{privateReads++;return null;},
  readStorageEvidence:async()=>{privateReads++;return {};}
 });
 await assert.rejects(()=>review({attemptId:'a',reviewerId:'admin',accessToken:'token'}),/authorization expired/);
 assert.equal(privateReads,0);
});
test('authorized reviewer can proceed to read-only classification',async()=>{
 let authorizations=0;
 const review=createRevealReconciliationReviewService({
  authorizeReviewer:async()=>{authorizations++;return true;},
  readAttempt:async()=>({id:'a',sender_id:'s',status:'pending',upload_uncertain_at:'now'}),
  readObjectBinding:async()=>null,
  readStorageEvidence:async()=>({state:'unavailable'})
 });
 assert.equal((await review({attemptId:'a',reviewerId:'admin',accessToken:'token'})).action,'manual_review');
 assert.equal(authorizations,3);
});
