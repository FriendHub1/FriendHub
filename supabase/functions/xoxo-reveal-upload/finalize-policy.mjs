// XOXO Reveal BETA — pure finalize decision mirror, NOT DEPLOYED.
// The SQL function must enforce these rules transactionally.
export function assessRevealUploadFinalization({
 attempt,senderId,claimToken,revealId,dmId,linkedReveal
}={}){
 if(!attempt||attempt.sender_id!==senderId)return {allowed:false,reason:"attempt_not_found"};
 if(!claimToken||attempt.claim_token!==claimToken)
   return {allowed:false,reason:"claim_owner_mismatch"};
 if(attempt.status==="completed")
   return attempt.reveal_id===revealId&&attempt.dm_id===dmId
     ? {allowed:true,reason:"already_completed"}
     : {allowed:false,reason:"completed_conflict"};
 if(attempt.status!=="pending")return {allowed:false,reason:"needs_reconciliation"};
 if(!linkedReveal||linkedReveal.id!==revealId||
    linkedReveal.dm_id!==dmId||linkedReveal.sender_id!==senderId||
    linkedReveal.dm_sender_id!==senderId||
    linkedReveal.recipient_id!==linkedReveal.dm_recipient_id)
   return {allowed:false,reason:"linked_dm_mismatch"};
 return {allowed:true,reason:"can_finalize"};
}
// Mock-only policy. Never rely on client-supplied linkedReveal for authorization.
