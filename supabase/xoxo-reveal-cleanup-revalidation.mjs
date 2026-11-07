// XOXO Reveal BETA — cleanup revalidation, read-only, NOT DEPLOYED.
// This is a pure decision helper; never directly deletes storage or records.
export function assessRevealDeletion({
  reveal,now=new Date(),graceMinutes=60,hasOpenReport=false,
  hasModerationHold=false,hasLegalHold=false
}={}){
  if(!reveal?.id||!reveal.object_path)return {allowed:false,reason:"missing_record"};
  if(reveal.mode==="keep")return {allowed:false,reason:"keep_mode"};
  if(hasOpenReport||hasModerationHold||hasLegalHold)
    return {allowed:false,reason:"retention_hold"};
  const current=now instanceof Date?now.getTime():NaN;
  if(!Number.isFinite(current)||!Number.isSafeInteger(graceMinutes)||graceMinutes<0)
    throw new TypeError("Invalid cleanup clock or grace period");
  const expiry=Date.parse(reveal.expires_at||"");
  if(!Number.isFinite(expiry))return {allowed:false,reason:"no_valid_expiry"};
  const grace=graceMinutes*60000;
  if(expiry+grace>current)return {allowed:false,reason:"not_expired_with_grace"};
  if(reveal.session_expires_at){
    const sessionEnd=Date.parse(reveal.session_expires_at);
    if(!Number.isFinite(sessionEnd)||sessionEnd+grace>current)
      return {allowed:false,reason:"session_active_or_unknown"};
  }
  return {allowed:true,reason:"expired_and_unheld"};
}
// A production worker MUST re-read records inside a lock/lease, verify holds
// from authoritative moderation tables, and recheck before Storage deletion.
// This function does not establish atomicity or authorize deletion.
