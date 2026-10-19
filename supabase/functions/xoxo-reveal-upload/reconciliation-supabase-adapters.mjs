// XOXO Reveal BETA — isolated read-only Supabase adapter contracts.
// NOT DEPLOYED. Inject trusted server-side readers; no credentials or network.
// Never accept browser-supplied attempt/object IDs as authority.
export function createRevealReconciliationReaders({
  getRevealAndDmByAttempt,getPrivateObjectByPath,getQuotaByAttempt
}={}){
  if([getRevealAndDmByAttempt,getPrivateObjectByPath,getQuotaByAttempt]
    .some(fn=>typeof fn!=="function"))throw new TypeError("Trusted readers required");
  const validAttempt=a=>a&&typeof a.id==="string"&&
    typeof a.sender_id==="string"&&typeof a.payload_fingerprint==="string"&&
    /^[a-f0-9]{64}$/.test(a.payload_fingerprint);
  const unknown=()=>({authoritative:false,state:"unknown"});
  return {
    async readLinkedMessage(attempt){
      if(!validAttempt(attempt))return unknown();
      try{
        const result=await getRevealAndDmByAttempt(attempt.id);
        if(!result?.authoritative)return unknown();
        if(result.state==="absent")return {authoritative:true,state:"absent"};
        if(result.state!=="present")return unknown();
        const {reveal,dm}=result;
        if(!reveal?.id||!dm?.id||reveal.dm_id!==dm.id||
           reveal.sender_id!==attempt.sender_id||
           dm.sender_id!==attempt.sender_id||
           reveal.recipient_id!==dm.recipient_id||
           reveal.attempt_id!==attempt.id||
           reveal.payload_fingerprint!==attempt.payload_fingerprint||
           !reveal.object_path||reveal.object_path!==result.objectPath)
          return unknown();
        return {authoritative:true,state:"present",revealId:reveal.id,
          dmId:dm.id,senderId:attempt.sender_id,attemptId:attempt.id};
      }catch{return unknown();}
    },
    async readStorage(attempt){
      if(!validAttempt(attempt))return unknown();
      try{
        // Storage locator must be resolved server-side from an immutable
        // attempt-to-object association; never from user input.
        const result=await getPrivateObjectByPath(attempt.id);
        if(!result?.authoritative)return unknown();
        if(result.state==="absent")return {authoritative:true,state:"absent"};
        if(result.state!=="present"||
           result.attemptId!==attempt.id||
           result.senderId!==attempt.sender_id||
           result.fingerprint!==attempt.payload_fingerprint||
           result.bucket!=="xoxo-reveal"||!result.path)
          return unknown();
        return {authoritative:true,state:"present"};
      }catch{return unknown();}
    },
    async readQuota(attempt){
      if(!validAttempt(attempt))return unknown();
      try{
        const result=await getQuotaByAttempt(attempt.id);
        if(!result?.authoritative||
           result.attemptId!==attempt.id||
           result.senderId!==attempt.sender_id)
          return unknown();
        if(result.state==="reserved"||result.state==="released")
          return {authoritative:true,state:result.state};
        return unknown();
      }catch{return unknown();}
    }
  };
}
// REVIEW BLOCKERS: current draft Reveal/quota tables do NOT yet provide
// immutable attempt_id / payload_fingerprint / object association columns.
// These readers cannot be wired to actual Supabase until schema is extended,
// unique constraints added, and trusted read consistency is reviewed.
// 'absent' must mean a completed authoritative lookup, not a 404 from a
// missing permission or an eventual-consistency timeout.
