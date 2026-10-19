// XOXO Reveal BETA — refund transaction coordinator CONTRACT.
// No SQL execution, no Storage access, no real refund.
// A real executor must implement a database-owned fence and authoritative
// post-fence Storage recheck; this module cannot establish either.
import {assessRevealRefundReadiness} from "./refund-readiness-coordinator.mjs";
export async function reviewFencedRevealRefund({
 attempt,openTrustedFence,readEvidenceInsideFence,nowMs
}={}){
 const deny=reason=>({allowed:false,reason});
 if(!attempt||typeof attempt.id!=="string"||typeof attempt.senderId!=="string"
 ||typeof openTrustedFence!=="function"||typeof readEvidenceInsideFence!=="function")
  return deny("missing_trusted_transaction_dependencies");
 let fence;
 try{
  fence=await openTrustedFence(attempt);
  if(!fence||fence.authoritative!==true||fence.attemptId!==attempt.id
   ||fence.senderId!==attempt.senderId||fence.active!==true)
   return deny("invalid_transaction_fence");
  const evidence=await readEvidenceInsideFence({attempt,fence});
  if(!evidence||evidence.authoritative!==true
   ||evidence.fenceId!==fence.id||evidence.attemptId!==attempt.id
   ||evidence.senderId!==attempt.senderId)
   return deny("invalid_fenced_evidence");
  // Explicitly require server attestations from the SAME active fence.
  if(evidence.snapshotConsistent!==true||evidence.attemptLocked!==true
   ||evidence.quotaLocked!==true||evidence.storageRecheckedAfterFence!==true)
   return deny("unverified_transaction_guarantees");
  const decision=assessRevealRefundReadiness({attempt,evidence,nowMs});
  if(!decision.allowed) return decision;
  return {...decision,fenceId:fence.id};
 }catch{
  return deny("trusted_transaction_review_failed");
 }finally{
  if(fence&&typeof fence.close==="function"){
   try{await fence.close();}catch{/* closed-state cannot be trusted */}
  }
 }
}
// NEVER pass this returned decision to a separate refund call: closing the
// fence destroys the atomicity guarantee. Actual refund MUST occur within
// the same transaction after a final authoritative recheck, or be denied.
