// XOXO Reveal BETA — trusted server delivery coordination, REVIEW ONLY.
// This is NOT a public endpoint and never performs Storage operations itself.
// prepareSealedUpload MUST verify writer ownership, persist the private object,
// reserve quota and seal the attempt before returning the trusted object path.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function createRecipientBoundDeliveryCoordinator({claimUpload,prepareSealedUpload,createLinkedMessage}={}){
 if([claimUpload,prepareSealedUpload,createLinkedMessage].some(fn=>typeof fn!=='function'))
  throw new TypeError('Trusted server dependencies required');
 return async function deliverReveal({senderId,recipientId,requestKey,payloadFingerprint,mediaType,mode,durationSeconds=null,bytes,mime}={}){
  if(!UUID.test(senderId||'')||!UUID.test(recipientId||'')||senderId===recipientId||
     !/^[A-Za-z0-9_-]{16,128}$/.test(requestKey||'')||
     !/^[0-9a-f]{64}$/.test(payloadFingerprint||'')||
     !['image','video'].includes(mediaType)||!['once','timed','keep'].includes(mode)||
     (mode==='timed'?![5,10,15,20].includes(durationSeconds):durationSeconds!==null))
   throw new TypeError('Invalid delivery request');
  const claim=await claimUpload({senderId,recipientId,requestKey,payloadFingerprint});
  if(claim?.action==='return_existing'){
   if(!UUID.test(claim.revealId||'')||!UUID.test(claim.dmId||''))
    throw new Error('Invalid existing delivery identifiers');
   return {action:'already_delivered',revealId:claim.revealId,dmId:claim.dmId};
  }
  if(claim?.action==='reject')return {action:'rejected'};
  if(claim?.action==='wait')return {action:'pending'};
  if(claim?.action==='manual_reconciliation')return {action:'needs_reconciliation'};
  if(claim?.action!=='claimed'||!UUID.test(claim.attemptId||'')||!UUID.test(claim.ownerToken||''))
   throw new Error('Invalid claim state');
  // Never start another write when an existing attempt is pending or uncertain.
  const sealed=await prepareSealedUpload({
   attemptId:claim.attemptId,claimToken:claim.ownerToken,
   senderId,recipientId,payloadFingerprint,mediaType,mode,durationSeconds,bytes,mime
  });
  if(!sealed||typeof sealed.objectPath!=='string'||!sealed.objectPath.trim()||
   sealed.objectPath.startsWith('/')||sealed.objectPath.includes('..')||
   sealed.objectPath.includes('?')||sealed.objectPath.includes('#')||
   sealed.objectPath.includes('\\\\')||
   sealed.attemptId!==claim.attemptId||
   sealed.senderId!==senderId||sealed.recipientId!==recipientId||
   sealed.payloadFingerprint!==payloadFingerprint||
   sealed.writerState!=='sealed'||sealed.uploadUncertain!==false)
   throw new Error('Trusted sealed upload required');
  const result=await createLinkedMessage({
   attemptId:claim.attemptId,claimToken:claim.ownerToken,
   senderId,recipientId,objectPath:sealed.objectPath,mediaType,mode,
   seconds:mode==='timed'?durationSeconds:null,durationSeconds:mode==='timed'?durationSeconds:null
  });
  if(!UUID.test(result?.revealId||'')||!UUID.test(result?.dmId||''))
   throw new Error('Atomic delivery returned invalid identifiers');
  return {action:'delivered',revealId:result.revealId,dmId:result.dmId};
 };
}
