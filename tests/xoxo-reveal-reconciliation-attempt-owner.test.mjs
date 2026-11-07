import test from 'node:test';
import assert from 'node:assert/strict';
import {createRevealReconciliationReviewService} from '../supabase/functions/xoxo-reveal-upload/reconciliation-review-service.mjs';

test('invalid persisted attempt owner cannot trigger private object reads',async()=>{
 let privateReads=0;
 for(const sender_id of [null,42,'  ']){
  const review=createRevealReconciliationReviewService({
   authorizeReviewer:async()=>true,
   readAttempt:async()=>({id:'attempt',sender_id,status:'pending',upload_uncertain_at:'now'}),
   readObjectBinding:async()=>{privateReads++;throw Error('should not read');},
   readStorageEvidence:async()=>{privateReads++;throw Error('should not read');}
  });
  await assert.rejects(review({attemptId:'attempt',reviewerId:'reviewer'}),/Reconciliation evidence unavailable/);
 }
 assert.equal(privateReads,0);
});
