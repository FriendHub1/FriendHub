// XOXO Reveal BETA — evidence freshness gate (pure, no writes).
// A timestamp alone never guarantees snapshot consistency or atomic refunds.
export function assessRefundEvidenceFreshness({evidence,nowMs,maxAgeMs=15000}={}){
 const deny=reason=>({allowed:false,reason});
 if(!evidence||evidence.authoritative!==true) return deny("not_authoritative");
 if(typeof nowMs!=="number"||!Number.isFinite(nowMs))
  return deny("invalid_reference_time");
 if(!Number.isInteger(maxAgeMs)||maxAgeMs<1||maxAgeMs>60000)
  return deny("invalid_max_age");
 const at=typeof evidence.checkedAt==="string"?Date.parse(evidence.checkedAt):NaN;
 if(!Number.isFinite(at)) return deny("missing_timestamp");
 const age=nowMs-at;
 if(age<0) return deny("future_evidence");
 if(age>maxAgeMs) return deny("stale_evidence");
 if(evidence.snapshotConsistent!==true) return deny("inconsistent_snapshot");
 if(evidence.attemptLocked!==true||evidence.quotaLocked!==true)
  return deny("missing_transaction_fence");
 if(evidence.storageRecheckedAfterFence!==true)
  return deny("storage_not_rechecked");
 return {allowed:true,reason:"fresh_fenced_evidence",ageMs:age};
}
// IMPORTANT: This checks trusted assertions; it does not itself acquire
// locks, query Storage, or prove no upload is concurrently in flight.
// A real server protocol must enforce the assertions before calling refund.
