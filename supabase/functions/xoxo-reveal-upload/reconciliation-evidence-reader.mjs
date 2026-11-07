// XOXO Reveal BETA — read-only evidence collector with injected trusted readers.
// No production credentials, network calls, writes or destructive operations.
// Readers must enforce service-side authorization and exact attempt ownership.
export async function collectRevealUploadEvidence({
 attempt,readStorage,readLinkedMessage,readQuota
}={}){
 if(!attempt?.id||!attempt.sender_id||!attempt.request_key||
    typeof readStorage!=="function"||
    typeof readLinkedMessage!=="function"||
    typeof readQuota!=="function")
  return {authoritative:false,storage:"unknown",linkedMessage:"unknown",quota:"unknown"};
 const unknown={authoritative:false,storage:"unknown",linkedMessage:"unknown",quota:"unknown"};
 try{
  const [storage,message,quota]=await Promise.all([
   readStorage(attempt),readLinkedMessage(attempt),readQuota(attempt)
  ]);
  // Each reader must affirm that it checked an authoritative source.
  if(!storage?.authoritative||!message?.authoritative||!quota?.authoritative)
   return unknown;
  if(!["present","absent"].includes(storage.state)||
     !["present","absent"].includes(message.state)||
     !["reserved","released"].includes(quota.state))
   return unknown;
  if(message.state==="present"&&
     (!message.revealId||!message.dmId||
      message.senderId!==attempt.sender_id||
      message.attemptId!==attempt.id))
   return unknown;
  return {
   authoritative:true,storage:storage.state,
   linkedMessage:message.state,quota:quota.state,
   ...(message.state==="present"?{
    revealId:message.revealId,dmId:message.dmId
   }:{})
  };
 }catch{
  // No partial evidence on failed reads; fail closed.
  return unknown;
 }
}
// The real implementation must verify object path, digest, recipient,
// sender, linked DM, quota reservation and authoritative snapshot consistency.
// Separate transactions cannot guarantee a shared snapshot across Storage/DB.
