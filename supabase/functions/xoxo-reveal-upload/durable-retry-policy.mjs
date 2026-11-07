// XOXO Reveal BETA — pure durable-attempt decision policy, NOT DEPLOYED.
// Database transaction/locking implementation is intentionally absent.
export function decideRevealUploadRetry({attempt,fingerprint}={}){
 if(typeof fingerprint!=="string"||!/^[0-9a-f]{64}$/.test(fingerprint))
  throw new TypeError("Server-calculated SHA-256 fingerprint required");
 if(attempt==null)return {action:"claim_new"};
 if(attempt.payload_fingerprint!==fingerprint)
  return {action:"reject",reason:"fingerprint_mismatch"};
 switch(attempt.status){
  case "completed":
   if(!attempt.reveal_id||!attempt.dm_id)
    return {action:"manual_reconciliation",reason:"incomplete_completed_record"};
   return {action:"return_existing",revealId:attempt.reveal_id,dmId:attempt.dm_id};
  case "pending":
   return {action:"wait",reason:"already_processing"};
  case "failed":
  case "needs_reconciliation":
   return {action:"manual_reconciliation",reason:"outcome_uncertain"};
  default:
   return {action:"manual_reconciliation",reason:"unknown_status"};
 }
}
// Never auto-retry an ambiguous failure. A lease timeout alone does not
// prove that an upload, linked DM, or quota reservation failed.
