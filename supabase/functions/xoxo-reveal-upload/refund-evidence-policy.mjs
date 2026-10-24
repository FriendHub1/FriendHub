// XOXO Reveal BETA — fail-closed refund evidence decision.
// Pure policy only. Does not access Storage, Supabase or change quotas.
export function assessRevealRefundEvidence({attempt,evidence}={}){
 const deny=(reason)=>({allowed:false,reason});
 if(!attempt||!evidence||typeof attempt.id!=="string"||typeof attempt.senderId!=="string")
  return deny("missing_attempt_or_evidence");
 if(attempt.status!=="failed") return deny("attempt_not_verified_failed");
 if(evidence.authoritative!==true) return deny("evidence_not_authoritative");
 if(evidence.attemptId!==attempt.id||evidence.senderId!==attempt.senderId)
  return deny("evidence_identity_mismatch");
 if(evidence.storageExists!==false||evidence.linkedMessageExists!==false)
  return deny("upload_or_message_may_exist");
 if(evidence.quotaExists!==true||evidence.quotaReleased!==false)
  return deny("quota_not_active");
 if(typeof evidence.quotaReservationId!=="string"||!evidence.quotaReservationId)
  return deny("missing_reservation");
 if(evidence.quotaAttemptId!==attempt.id||evidence.quotaSenderId!==attempt.senderId)
  return deny("quota_identity_mismatch");
 if(evidence.hasHold!==false||evidence.hasUncertainOperation!==false)
  return deny("hold_or_uncertain_operation");
 if(typeof evidence.checkedAt!=="string"||Number.isNaN(Date.parse(evidence.checkedAt)))
  return deny("missing_evidence_timestamp");
 return {allowed:true,reason:"eligible_for_fenced_server_refund",reservationId:evidence.quotaReservationId};
}
// CRITICAL: this policy cannot prove the evidence is fresh or immutable.
// Trusted server must read authoritative Storage/DM/quota state and fence
// concurrent upload/finalize/refund operations in one reviewed protocol.
