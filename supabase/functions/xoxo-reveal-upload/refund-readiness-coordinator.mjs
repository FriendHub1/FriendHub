// XOXO Reveal BETA — pure refund decision coordinator.
// NOT a refund executor. No database, Storage, network, or side effects.
import {assessRevealRefundEvidence} from "./refund-evidence-policy.mjs";
import {assessRefundEvidenceFreshness} from "./refund-evidence-freshness.mjs";
export function assessRevealRefundReadiness({attempt,evidence,nowMs}={}){
 const identity=assessRevealRefundEvidence({attempt,evidence});
 if(!identity.allowed) return {allowed:false,reason:identity.reason};
 const freshness=assessRefundEvidenceFreshness({evidence,nowMs});
 if(!freshness.allowed) return {allowed:false,reason:freshness.reason};
 return {
  allowed:true,
  reason:"eligible_for_trusted_transactional_refund_review",
  attemptId:attempt.id,
  senderId:attempt.senderId,
  reservationId:identity.reservationId
 };
}
// This is advisory only. The real executor must authenticate service role,
// establish locks, re-read Storage and DB evidence, and refund atomically.
// A caller may forge evidence fields; never use this as authorization.
