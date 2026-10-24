// XOXO Reveal BETA — pure reconciliation decision, NOT DEPLOYED.
// Evidence must come from trusted, authoritative server-side reads.
// This module never changes attempts, Storage, DMs or quota reservations.
export function assessInterruptedRevealUpload({attempt,evidence}={}){
 if(!attempt?.id||!attempt.sender_id||!attempt.request_key)
  return {action:"manual_review",reason:"invalid_attempt"};
 if(attempt.status==="completed"){
  if(attempt.reveal_id&&attempt.dm_id)
   return {action:"return_existing",revealId:attempt.reveal_id,dmId:attempt.dm_id};
  return {action:"manual_review",reason:"incomplete_completion"};
 }
 if(!["pending","failed","needs_reconciliation"].includes(attempt.status))
  return {action:"manual_review",reason:"unknown_attempt_status"};
 if(!evidence||evidence.authoritative!==true ||
    !["present","absent","unknown"].includes(evidence.storage) ||
    !["present","absent","unknown"].includes(evidence.linkedMessage) ||
    !["reserved","released","unknown"].includes(evidence.quota))
  return {action:"manual_review",reason:"insufficient_evidence"};
 if(evidence.storage==="unknown"||evidence.linkedMessage==="unknown"||
    evidence.quota==="unknown")
  return {action:"manual_review",reason:"uncertain_remote_state"};
 if(evidence.linkedMessage==="present"){
  if(evidence.storage!=="present"||!evidence.revealId||!evidence.dmId)
   return {action:"manual_review",reason:"inconsistent_linked_message"};
  // Must validate exact sender, recipient, object path, fingerprint and
  // ownership inside a transaction before a real finalize operation.
  return {action:"verify_then_finalize",reason:"linked_result_found",
    revealId:evidence.revealId,dmId:evidence.dmId};
 }
 if(evidence.storage==="present")
  return {action:"manual_review",reason:"orphan_object_possible"};
 if(evidence.quota==="reserved")
  return {action:"verify_then_refund",reason:"no_storage_or_message"};
 return {action:"close_without_retry",reason:"no_remote_artifacts"};
}
// Even a 'close_without_retry' result never authorizes blind new uploads.
// Any production state change requires a separate atomic, audited action.
