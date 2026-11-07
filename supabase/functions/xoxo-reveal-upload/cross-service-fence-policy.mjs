// XOXO Reveal BETA — fail-closed cross-service write-fence policy.
// Pure validation only; NOT a real lock, transaction or Supabase adapter.
// Server must obtain durable attempt-scoped ownership before using decisions.
export function assessRevealCrossServiceFence({attempt,fence,storage,linkedDm,quota}={}){
 const deny=reason=>({allowed:false,reason});
 if(!attempt?.id||!attempt?.sender_id||!attempt?.payload_fingerprint)
  return deny('invalid_attempt');
 if(attempt.status!=='failed')return deny('attempt_not_failed');
 if(!fence||fence.authoritative!==true||fence.active!==true||
    fence.attemptId!==attempt.id||fence.senderId!==attempt.sender_id||
    typeof fence.token!=='string'||!fence.token||
    fence.writeLeaseRevoked!==true||fence.noActiveStorageWriter!==true||
    fence.noActiveDmWriter!==true||fence.noActiveFinalizer!==true)
  return deny('durable_writer_fence_unproven');
 if(!storage||storage.authoritative!==true||
    storage.checkedAfterFence!==true||storage.fenceToken!==fence.token||
    storage.attemptId!==attempt.id||storage.state!=='absent')
  return deny('storage_absence_unproven');
 if(!linkedDm||linkedDm.authoritative!==true||
    linkedDm.checkedAfterFence!==true||linkedDm.fenceToken!==fence.token||
    linkedDm.attemptId!==attempt.id||linkedDm.state!=='absent')
  return deny('dm_absence_unproven');
 if(!quota||quota.authoritative!==true||
    quota.checkedAfterFence!==true||quota.fenceToken!==fence.token||
    quota.attemptId!==attempt.id||quota.senderId!==attempt.sender_id||
    quota.state!=='reserved'||typeof quota.reservationId!=='string'||
    !quota.reservationId)
  return deny('quota_reservation_unproven');
 return {allowed:true,reason:'eligible_for_atomic_refund_review',
  attemptId:attempt.id,reservationId:quota.reservationId,fenceToken:fence.token};
}
// IMPORTANT: Caller-provided booleans do NOT prove durable fencing.
// Never use this function alone to authorize a production refund.
