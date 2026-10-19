// XOXO Reveal BETA — read-only privileged reconciliation review.
// REVIEW ONLY / NOT DEPLOYED. This service never clears a marker, starts
// an upload, finalizes a reveal, sends a DM, or deletes an object.
import {decideRevealUploadReconciliation} from './upload-reconciliation-decision.mjs';
export function createRevealReconciliationReviewService({
 readAttempt,readObjectBinding,readStorageEvidence,authorizeReviewer
}={}){
 if([readAttempt,readObjectBinding,readStorageEvidence,authorizeReviewer]
   .some(fn=>typeof fn!=='function'))
  throw new TypeError('Trusted reconciliation readers and reviewer authorization required');
 return async function review({attemptId,reviewerId,accessToken}={}){
  if(!attemptId||!reviewerId)throw new TypeError('Missing review identity');
  if(await authorizeReviewer({attemptId,reviewerId,accessToken})!==true)
   throw new Error('Reviewer not authorized');
  const attempt=await readAttempt({attemptId});
  if(!attempt||attempt.id!==attemptId)
   return {action:'manual_review',reason:'missing_attempt'};
  // Recheck authorization before touching the private object evidence.
  if(await authorizeReviewer({attemptId,reviewerId,accessToken})!==true)
   throw new Error('Reviewer authorization expired');
  const objectBinding=await readObjectBinding({attemptId,senderId:attempt.sender_id});
  const storageEvidence=await readStorageEvidence({attemptId,senderId:attempt.sender_id,objectBinding});
  return decideRevealUploadReconciliation({attempt,objectBinding,storageEvidence});
 };
}
