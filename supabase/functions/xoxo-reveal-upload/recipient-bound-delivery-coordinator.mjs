// XOXO Reveal BETA — trusted server delivery coordination, REVIEW ONLY.
// This is NOT a public endpoint and never performs Storage operations itself.
// prepareSealedUpload MUST verify writer ownership, persist the private object,
// reserve quota and seal the attempt before returning the trusted object path.
export function createRecipientBoundDeliveryCoordinator({claimUpload,prepareSealedUpload,createLinkedMessage}={}){
 if([claimUpload,prepareSealedUpload,createLinkedMessage].some(fn=>typeof fn!=='function'))
  throw new TypeError('Trusted server dependencies required');
 return async function deliverReveal({senderId,recipientId,requestKey,payloadFingerprint,mediaType,mode,durationSeconds=null}={}){
  const claim=await claimUpload({senderId,recipientId,requestKey,payloadFingerprint});
  if(claim.action==='return_existing')
   return {action:'already_delivered',revealId:claim.revealId,dmId:claim.dmId};
  if(claim.action==='reject')return {action:'rejected'};
  if(claim.action==='wait')return {action:'pending'};
  if(claim.action==='manual_reconciliation')return {action:'needs_reconciliation'};
  if(claim.action!=='claimed'||!claim.attemptId||!claim.ownerToken)
   throw new Error('Invalid claim state');
  // Never start another write when an existing attempt is pending or uncertain.
  const sealed=await prepareSealedUpload({
   attemptId:claim.attemptId,claimToken:claim.ownerToken,
   senderId,recipientId,payloadFingerprint,mediaType,mode,durationSeconds
  });
  if(!sealed||typeof sealed.objectPath!=='string'||!sealed.objectPath.trim()||
   sealed.objectPath.startsWith('/')||sealed.objectPath.includes('..')||
   sealed.objectPath.includes('?')||sealed.objectPath.includes('#')||
   sealed.objectPath.includes('\\\\')||
   (sealed.attemptId!==undefined&&sealed.attemptId!==claim.attemptId)||
   (sealed.recipientId!==undefined&&sealed.recipientId!==recipientId)||
   (sealed.payloadFingerprint!==undefined&&sealed.payloadFingerprint!==payloadFingerprint))
   throw new Error('Trusted sealed upload required');
  const result=await createLinkedMessage({
   attemptId:claim.attemptId,claimToken:claim.ownerToken,
   senderId,recipientId,objectPath:sealed.objectPath,mediaType,mode,
   seconds:mode==='timed'?durationSeconds:null,durationSeconds:mode==='timed'?durationSeconds:null
  });
  return {action:'delivered',revealId:result.revealId,dmId:result.dmId};
 };
}
