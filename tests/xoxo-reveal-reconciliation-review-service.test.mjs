import test from 'node:test';
import assert from 'node:assert/strict';
import {createRevealReconciliationReviewService} from '../supabase/functions/xoxo-reveal-upload/reconciliation-review-service.mjs';
const attempt={id:'a',sender_id:'s',status:'pending',upload_uncertain_at:'2026-10-19'};
const binding={attemptId:'a',senderId:'s'};
test('unauthorized reviewer never reads private evidence',async()=>{
 let reads=0;
 const review=createRevealReconciliationReviewService({
  authorizeReviewer:async()=>false,
  readAttempt:async()=>{reads++;return attempt;},
  readObjectBinding:async()=>{reads++;return binding;},
  readStorageEvidence:async()=>{reads++;return {state:'present'};}
 });
 await assert.rejects(()=>review({attemptId:'a',reviewerId:'u'}),/not authorized/);
 assert.equal(reads,0);
});
test('authorized reviewer gets manual review classification without writes',async()=>{
 const review=createRevealReconciliationReviewService({
  authorizeReviewer:async()=>true,
  readAttempt:async()=>attempt,
  readObjectBinding:async()=>binding,
  readStorageEvidence:async()=>({state:'present',digestMatches:true,writerQuiescent:true})
 });
 assert.deepEqual(await review({attemptId:'a',reviewerId:'admin'}),{
  action:'manual_review',reason:'verified_object_requires_privileged_resolution'
 });
});
test('missing attempt is a manual review, not an automatic reset',async()=>{
 const review=createRevealReconciliationReviewService({
  authorizeReviewer:async()=>true,
  readAttempt:async()=>null,
  readObjectBinding:async()=>{throw Error('must not read');},
  readStorageEvidence:async()=>{throw Error('must not read');}
 });
 assert.equal((await review({attemptId:'a',reviewerId:'admin'})).reason,'missing_attempt');
});
