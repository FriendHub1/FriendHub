// XOXO Reveal BETA — post-upload binding gate, REVIEW ONLY / NOT DEPLOYED.
// Caller must be trusted server code. No DM is published by this module.
// Storage acknowledgment alone never proves DB binding or object integrity.
export function createRevealPostUploadBindingGate({
 readTrustedEvidence,finalizeAttempt
}={}){
 if(typeof readTrustedEvidence!=='function'||typeof finalizeAttempt!=='function')
  throw new TypeError('Trusted evidence and finalize adapters required');
 return async function finalize({attemptId,senderId,claimToken,revealId,dmId,objectPath,payloadFingerprint}={}){
  if([attemptId,senderId,claimToken,revealId,dmId,objectPath,payloadFingerprint]
     .some(x=>typeof x!=='string'||!x))
   return {ok:false,reason:'invalid_binding_context'};
  let evidence;
  try{evidence=await readTrustedEvidence({attemptId,senderId,revealId,dmId,objectPath,payloadFingerprint});}
  catch{return {ok:false,reason:'binding_evidence_uncertain'};}
  if(!evidence||evidence.authoritative!==true||
     evidence.attemptId!==attemptId||evidence.senderId!==senderId||
     evidence.revealId!==revealId||evidence.dmId!==dmId||
     evidence.objectPath!==objectPath||
     evidence.payloadFingerprint!==payloadFingerprint||
     evidence.storageObjectVerified!==true||
     evidence.storageDigestMatches!==true||
     evidence.dmAuthorizedAtLink!==true||
     evidence.recipientMatches!==true||
     evidence.quotaReservationBound!==true||
     evidence.writerStateSafe!==true)
   return {ok:false,reason:'binding_evidence_not_verified'};
  let result;
  try{result=await finalizeAttempt({attemptId,senderId,claimToken,revealId,dmId});}
  catch{return {ok:false,reason:'finalize_uncertain_manual_reconciliation'};}
  if(result!=='completed'&&result!=='already_completed')
   return {ok:false,reason:'finalize_not_confirmed'};
  return {ok:true,reason:result};
 };
}
// Evidence fields are assertions by trusted adapters, not verification themselves.
// Finalize RPC must revalidate bindings transactionally. Do not expose to clients.
// A late Storage commit or concurrent DM block still requires reconciliation.
