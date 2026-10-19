// XOXO Reveal BETA — token-bound, read-only review entrypoint.
// REVIEW ONLY / NOT DEPLOYED. Requires trusted service-role client,
// verified admin RPC and server-only Storage integrity dependencies.
import {createRevealReconciliationReviewerAuthorizer} from './reconciliation-reviewer-authorizer.mjs';
import {createRevealReconciliationAdminLookup} from './reconciliation-admin-lookup.mjs';
import {createRevealReconciliationSupabaseService} from './reconciliation-supabase-service.mjs';
export function createRevealAuthenticatedReconciliationService({
 supabase,authClient,readIntegrity,readTrustedFingerprint
}={}){
 const adminLookup=createRevealReconciliationAdminLookup({rpcClient:supabase});
 const authorizeReviewer=createRevealReconciliationReviewerAuthorizer({
  authClient,adminLookup
 });
 const review=createRevealReconciliationSupabaseService({
  supabase,authorizeReviewer,readIntegrity,readTrustedFingerprint
 });
 return async function reviewWithToken({attemptId,accessToken}={}){
  if(typeof attemptId!=='string'||!attemptId.trim()||
     typeof accessToken!=='string'||!accessToken.trim())
   throw new TypeError('Review attempt and access token required');
  // Derive reviewer identity exclusively from the verified token.
  let data,error;
  try{({data,error}=await authClient.auth.getUser(accessToken));}
  catch{throw new Error('Reviewer not authenticated');}
  const reviewerId=data?.user?.id;
  if(error||!reviewerId)throw new Error('Reviewer not authenticated');
  return review({attemptId,reviewerId,accessToken});
 };
}
// Authorization is deliberately denied by the review-only SQL stub until
// real admin membership is verified. No writes or deliveries occur here.
