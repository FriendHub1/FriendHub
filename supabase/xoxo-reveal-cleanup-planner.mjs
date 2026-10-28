// XOXO Reveal BETA — read-only cleanup candidate planner, NOT DEPLOYED.
// No database writes, Storage deletes, or scheduled jobs.
export function planRevealCleanup({reveals=[],reservations=[],now=new Date(),graceMinutes=60,retentionDays=7}={}) {
  const timestamp=now instanceof Date?now.getTime():NaN;
  if(!Number.isFinite(timestamp))throw new TypeError("Invalid current time");
  if(!Number.isSafeInteger(graceMinutes)||graceMinutes<0 ||
     !Number.isSafeInteger(retentionDays)||retentionDays<1)throw new TypeError("Invalid cleanup policy");
  const graceMs=graceMinutes*60000;
  const retentionMs=retentionDays*86400000;
  const expired=[];
  const deferred=[];
  for(const row of reveals){
    if(!row?.id||!row.object_path||row.mode==="keep"||!row.expires_at)continue;
    const expires=Date.parse(row.expires_at);
    if(!Number.isFinite(expires)||expires>timestamp)continue;
    const sessionUntil=row.session_expires_at?Date.parse(row.session_expires_at):NaN;
    if((Number.isFinite(sessionUntil)&&sessionUntil+graceMs>timestamp) ||
       expires+graceMs>timestamp){
      deferred.push({id:row.id,reason:"session_or_grace"});
      continue;
    }
    expired.push({id:row.id,reason:"expired",objectPathPresent:true});
  }
  const staleReservations=[];
  for(const row of reservations){
    if(!row?.id||row.released_at||!row.created_at)continue;
    const created=Date.parse(row.created_at);
    if(Number.isFinite(created)&&created+retentionMs<=timestamp)
      staleReservations.push({id:row.id,reason:"older_than_retention"});
  }
  return {dryRun:true,expiredReveals:expired,deferredReveals:deferred,
    staleReservations,requiresManualReview:true};
}
// CRITICAL: Expired Reveal records may need to be retained for moderation,
// legal holds, and reports. A future deletion worker must atomically lease
// each candidate, recheck session expiry, and delete only from xoxo-reveal
// bucket with audit logging. Reservation cleanup needs reconciliation with
// incomplete uploads. Do not delete based on this plan alone.
