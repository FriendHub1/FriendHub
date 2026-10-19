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
 const checkAuthorization=async identity=>{
  try{return await authorizeReviewer(identity)===true;}catch{return false;}
 };
 return async function review({attemptId,reviewerId,accessToken}={}){
  if([attemptId,reviewerId].some(value=>
   typeof value!=='string'||!value.trim()))
   throw new TypeError('Valid review identity required');
  if(await checkAuthorization({attemptId,reviewerId,accessToken})!==true)
   throw new Error('Reviewer not authorized');
  let attempt;
  try{attempt=await readAttempt({attemptId});}
  catch{throw new Error('Reconciliation evidence unavailable');}
  if(!attempt||attempt.id!==attemptId){
   // Even a missing-record finding must not leak after permission revocation.
   if(await checkAuthorization({attemptId,reviewerId,accessToken})!==true)
    throw new Error('Reviewer authorization expired');
   return {action:'manual_review',reason:'missing_attempt'};
  }
  // Recheck authorization before touching the private object evidence.
  if(await checkAuthorization({attemptId,reviewerId,accessToken})!==true)
   throw new Error('Reviewer authorization expired');
  let objectBinding,storageEvidence;
  try{
   objectBinding=await readObjectBinding({attemptId,senderId:attempt.sender_id});
   storageEvidence=await readStorageEvidence({attemptId,senderId:attempt.sender_id,objectBinding});
  }catch{throw new Error('Reconciliation evidence unavailable');}
  // Never disclose reconciliation findings after a mid-read permission loss.
  if(await checkAuthorization({attemptId,reviewerId,accessToken})!==true)
   throw new Error('Reviewer authorization expired');
  return decideRevealUploadReconciliation({attempt,objectBinding,storageEvidence});
 };
}
