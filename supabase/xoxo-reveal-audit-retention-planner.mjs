// XOXO Reveal BETA — audit retention planner, READ ONLY / NOT DEPLOYED.
// Proposes records for review only. Never deletes or modifies any database rows.
export const AUDIT_RETENTION_DAYS=90;
export function planRevealAuditRetention({
 events=[],now=new Date(),retentionDays=AUDIT_RETENTION_DAYS,
 getHoldStatus
}={}){
 if(!Array.isArray(events)||events.length>500)throw new TypeError("Invalid audit batch");
 if(!Number.isSafeInteger(retentionDays)||retentionDays<1)throw new TypeError("Invalid retention days");
 if(typeof getHoldStatus!=="function")throw new TypeError("Authoritative hold lookup required");
 const time=now instanceof Date?now.getTime():NaN;
 if(!Number.isFinite(time))throw new TypeError("Invalid retention clock");
 const candidates=[],deferred=[];
 for(const event of events){
   if(!Number.isSafeInteger(event?.id)||event.id<=0||typeof event.reveal_id!=="string"){
     deferred.push({id:event?.id??null,reason:"invalid_record"});continue;
   }
   const created=Date.parse(event.occurred_at||"");
   if(!Number.isFinite(created)){deferred.push({id:event.id,reason:"invalid_timestamp"});continue;}
   if(created+retentionDays*86400000>time){
     deferred.push({id:event.id,reason:"within_retention"});continue;
   }
   let holds;
   try{holds=getHoldStatus(event.reveal_id);}catch{holds=null;}
   if(!holds||typeof holds!=="object"||
      !["openReport","moderationHold","legalHold"].every(k=>typeof holds[k]==="boolean")){
     deferred.push({id:event.id,reason:"hold_status_unknown"});continue;
   }
   if(holds.openReport||holds.moderationHold||holds.legalHold){
     deferred.push({id:event.id,reason:"retention_hold"});continue;
   }
   candidates.push({id:event.id,reason:"past_retention_no_holds"});
 }
 return {dryRun:true,retentionDays,candidates,deferred,requiresApproval:true};
}
// An actual purge requires privileged, audited maintenance and a separately
// reviewed trigger-bypass mechanism; this module cannot delete audit records.
// Holds must be checked authoritatively immediately before any future purge.
