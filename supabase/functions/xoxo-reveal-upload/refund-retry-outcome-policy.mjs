// XOXO Reveal BETA — refund idempotency outcome policy (pure).
// This does not read Supabase or issue refunds.
export function assessRefundRetryOutcome({attemptId,senderId,reservationId,record}={}){
 const deny=reason=>({action:"manual_reconciliation",reason});
 if(!attemptId||!senderId||!reservationId||!record)
  return deny("missing_identity_or_record");
 if(record.attemptId!==attemptId||record.senderId!==senderId
  ||record.reservationId!==reservationId)
  return deny("identity_mismatch");
 if(record.authoritative!==true) return deny("not_authoritative");
 if(record.status==="released"&&record.releaseCommitted===true)
  return {action:"return_existing",reason:"confirmed_release"};
 if(record.status==="active"&&record.releaseCommitted===false
  &&record.attemptStatus==="failed"
  &&record.storageAbsentVerified===true
  &&record.dmAbsentVerified===true
  &&record.noInFlightOperations===true)
  return {action:"retry_inside_new_fenced_transaction",reason:"verified_not_released"};
 return deny("unknown_or_conflicting_refund_outcome");
}
// A retry decision is never authorization to refund directly: new locks,
// fresh authoritative evidence and in-transaction release are mandatory.
