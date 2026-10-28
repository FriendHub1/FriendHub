// XOXO Reveal BETA — trusted refund evidence reader adapter.
// No Supabase network calls are performed here. Only inject server-owned
// authenticated readers; NEVER accept evidence supplied by a browser.
export async function collectTrustedRefundEvidence({
 attempt,readStorage,readLinkedDm,readQuota,readHold,readOperation,clock=()=>new Date()
}={}){
 const unknown=(reason)=>({authoritative:false,reason});
 if(!attempt||typeof attempt.id!=="string"||typeof attempt.senderId!=="string"
 ||typeof readStorage!=="function"||typeof readLinkedDm!=="function"
 ||typeof readQuota!=="function"||typeof readHold!=="function"
 ||typeof readOperation!=="function") return unknown("missing_trusted_readers");
 try{
  const [storage,dm,quota,hold,operation]=await Promise.all([
   readStorage(attempt),readLinkedDm(attempt),readQuota(attempt),
   readHold(attempt),readOperation(attempt)
  ]);
  if(!storage||!dm||!quota||!hold||!operation)
   return unknown("missing_authoritative_result");
  if([storage,dm,quota,hold,operation].some(x=>x.authoritative!==true))
   return unknown("untrusted_result");
  if(storage.attemptId!==attempt.id||dm.attemptId!==attempt.id
   ||quota.attemptId!==attempt.id||hold.attemptId!==attempt.id
   ||operation.attemptId!==attempt.id) return unknown("attempt_mismatch");
  if(quota.senderId!==attempt.senderId) return unknown("sender_mismatch");
  if(typeof storage.exists!=="boolean"||typeof dm.exists!=="boolean"
   ||typeof quota.exists!=="boolean"||typeof quota.released!=="boolean"
   ||typeof hold.exists!=="boolean"||typeof operation.uncertain!=="boolean")
   return unknown("ambiguous_evidence");
  const date=clock();
  if(!(date instanceof Date)||!Number.isFinite(date.getTime()))
   return unknown("invalid_clock");
  return {
   authoritative:true,attemptId:attempt.id,senderId:attempt.senderId,
   storageExists:storage.exists,linkedMessageExists:dm.exists,
   quotaExists:quota.exists,quotaReleased:quota.released,
   quotaReservationId:quota.reservationId,
   quotaAttemptId:quota.attemptId,quotaSenderId:quota.senderId,
   hasHold:hold.exists,hasUncertainOperation:operation.uncertain,
   checkedAt:date.toISOString(),
   // Intentionally false: parallel reads cannot prove a single locked
   // snapshot or guarantee Storage was rechecked after the lock.
   snapshotConsistent:false,attemptLocked:false,quotaLocked:false,
   storageRecheckedAfterFence:false
  };
 }catch{return unknown("trusted_read_failed");}
}
// A separate trusted transactional executor must acquire locks, repeat
// Storage check after fencing and attest snapshot consistency. Until then
// refund-readiness-coordinator will correctly reject this evidence.
