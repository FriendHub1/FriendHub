// XOXO Reveal BETA — server-verified reviewer authorization.
// REVIEW ONLY / NOT DEPLOYED. The caller supplies a trusted service client
// and a validated auth token, never an arbitrary browser-provided reviewer ID.
export function createRevealReconciliationReviewerAuthorizer({
 authClient,adminLookup
}={}){
 if(typeof authClient?.auth?.getUser!=='function'||typeof adminLookup!=='function')
  throw new TypeError('Trusted auth verification and admin lookup required');
 return async function authorizeReviewer({attemptId,reviewerId,accessToken}={}){
  if(!attemptId||!reviewerId||typeof accessToken!=='string'||!accessToken)
   return false;
  try{
   const {data,error}=await authClient.auth.getUser(accessToken);
   const verifiedId=data?.user?.id;
   if(error||!verifiedId||verifiedId!==reviewerId)return false;
   const isAdmin=await adminLookup({userId:verifiedId});
   if(isAdmin!==true)return false;
   // Revalidate the same bearer token after the privileged permission check.
   // This narrows (but cannot eliminate) concurrent revocation races.
   const second=await authClient.auth.getUser(accessToken);
   return !second.error&&second.data?.user?.id===verifiedId;
  }catch{return false;}
 };
}
// Do not use a client-provided role flag or rely on RLS bypass as admin proof.
// This authorizer requires a trusted, separately reviewed adminLookup.
