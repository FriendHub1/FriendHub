// XOXO Reveal BETA — read-only reconciliation service composition.
// REVIEW ONLY / NOT DEPLOYED. All dependencies must be privileged server-side.
import {createRevealReconciliationReviewService} from './reconciliation-review-service.mjs';
import {createRevealReconciliationSupabaseReaders} from './reconciliation-supabase-readers.mjs';
import {createRevealReconciliationStorageEvidence} from './reconciliation-storage-evidence.mjs';
export function createRevealReconciliationSupabaseService({
 supabase,authorizeReviewer,readIntegrity,readTrustedFingerprint
}={}){
 if(typeof authorizeReviewer!=='function'||typeof readIntegrity!=='function'||
    typeof readTrustedFingerprint!=='function')
  throw new TypeError('Trusted reviewer and private evidence dependencies required');
 const {readAttempt,readObjectBinding}=
  createRevealReconciliationSupabaseReaders({supabase});
 const readStorageEvidence=createRevealReconciliationStorageEvidence({
  readIntegrity,readTrustedFingerprint
 });
 return createRevealReconciliationReviewService({
  authorizeReviewer,readAttempt,readObjectBinding,readStorageEvidence
 });
}
// This composition cannot itself prove exclusive Storage writer quiescence.
// It never mutates rows, deletes objects, clears uncertainty or sends DMs.
