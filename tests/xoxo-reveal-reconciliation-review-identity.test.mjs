import test from 'node:test';
import assert from 'node:assert/strict';
import {createRevealReconciliationReviewService} from '../supabase/functions/xoxo-reveal-upload/reconciliation-review-service.mjs';

test('invalid review identities never call authorization or private readers',async()=>{
 let calls=0;
 const fail=async()=>{calls++;throw new Error('unexpected access');};
 const review=createRevealReconciliationReviewService({
  readAttempt:fail,readObjectBinding:fail,readStorageEvidence:fail,authorizeReviewer:fail
 });
 for(const input of [
  {attemptId:' ',reviewerId:'admin'},
  {attemptId:23,reviewerId:'admin'},
  {attemptId:'attempt',reviewerId:' '},
  {attemptId:'attempt',reviewerId:{}}
 ])
  await assert.rejects(review(input),TypeError);
 assert.equal(calls,0);
});
test('trusted injected authorizer remains supported without bearer token in core service',async()=>{
 let checks=0;
 const review=createRevealReconciliationReviewService({
  readAttempt:async()=>null,
  readObjectBinding:async()=>{throw new Error('unexpected');},
  readStorageEvidence:async()=>{throw new Error('unexpected');},
  authorizeReviewer:async()=>{checks++;return true;}
 });
 assert.deepEqual(await review({attemptId:'attempt',reviewerId:'admin'}),{
  action:'manual_review',reason:'missing_attempt'
 });
 assert.equal(checks,2);
});
