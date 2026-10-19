// XOXO Reveal BETA — isolated atomic refund executor contract.
// The supplied withTransaction MUST hold DB locks through callback completion,
// and commit/rollback atomically. No production adapter is provided.
import {assessRevealRefundReadiness} from "./refund-readiness-coordinator.mjs";
export async function executeIsolatedRevealRefund({
 attempt,nowMs,withTransaction
}={}){
 const deny=reason=>({ok:false,reason});
 if(!attempt||typeof attempt.id!=="string"||typeof attempt.senderId!=="string"
 ||typeof withTransaction!=="function") return deny("invalid_dependencies");
 try{
  return await withTransaction(async tx=>{
   if(!tx||typeof tx.lockAttemptAndQuota!=="function"
    ||typeof tx.readAuthoritativeEvidence!=="function"
    ||typeof tx.releaseQuota!=="function") throw Error("incomplete_transaction");
   const fence=await tx.lockAttemptAndQuota(attempt);
   if(!fence||fence.authoritative!==true||fence.active!==true
    ||fence.attemptId!==attempt.id||fence.senderId!==attempt.senderId
    ||typeof fence.id!=="string"||!fence.id) throw Error("invalid_fence");
   // Evidence MUST be re-read after locks are acquired.
   const evidence=await tx.readAuthoritativeEvidence({attempt,fence});
   if(!evidence||evidence.fenceId!==fence.id
    ||evidence.attemptId!==attempt.id||evidence.senderId!==attempt.senderId)
    throw Error("evidence_fence_mismatch");
   const decision=assessRevealRefundReadiness({attempt,evidence,nowMs});
   if(!decision.allowed) throw Error("refund_denied:"+decision.reason);
   // The release happens INSIDE the same callback / transaction, not later.
   const released=await tx.releaseQuota({
    attemptId:attempt.id,senderId:attempt.senderId,
    reservationId:decision.reservationId,fenceId:fence.id
   });
   if(!released||released.authoritative!==true
    ||released.fenceId!==fence.id
    ||released.reservationId!==decision.reservationId
    ||released.status!=="released") throw Error("release_not_confirmed");
   return {ok:true,status:"released",reservationId:decision.reservationId};
  });
 }catch{
  // Never expose a success on timeout/uncertain commit. Caller must reconcile.
  return deny("transaction_failed_or_outcome_uncertain");
 }
}
// Security boundary: the injected transaction implementation is trusted code.
// This contract does not itself prove Storage consistency or transaction
// durability; use only in disposable test harness until real adapters audited.
