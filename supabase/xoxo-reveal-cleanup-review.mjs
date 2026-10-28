// XOXO Reveal BETA — read-only cleanup review with sanitized audit events.
// NOT DEPLOYED. Does not persist events or delete any Storage objects.
import {assessRevealDeletion} from "./xoxo-reveal-cleanup-revalidation.mjs";
import {createRevealCleanupAuditEvent} from "./xoxo-reveal-cleanup-audit.mjs";

export function reviewRevealCleanupBatch({
  reveals=[],now=new Date(),operationId,graceMinutes=60,
  getHolds=()=>({hasOpenReport:true})
}={}){
  if(!Array.isArray(reveals)||reveals.length>100)throw new TypeError("Invalid cleanup batch");
  if(typeof getHolds!=="function")throw new TypeError("Hold lookup required");
  const events=[];
  let eligible=0,deferred=0;
  for(const reveal of reveals){
    // Fail closed: no authoritative hold result means the file is retained.
    let holds;
    try{holds=getHolds(reveal.id);}catch{holds=null;}
    const known=holds&&typeof holds==="object" &&
      ["hasOpenReport","hasModerationHold","hasLegalHold"].every(
        key=>typeof holds[key]==="boolean");
    const decision=known?
      assessRevealDeletion({reveal,now,graceMinutes,...holds}):
      {allowed:false,reason:"manual_review"};
    if(decision.allowed)eligible++;else deferred++;
    events.push(createRevealCleanupAuditEvent({
      revealId:reveal.id,
      action:decision.allowed?"cleanup_eligible":"cleanup_deferred",
      reason:decision.reason,now,operationId
    }));
  }
  return {dryRun:true,eligible,deferred,events};
}
// RELEASE BLOCKERS: getHolds must read authoritative moderation state,
// inside an atomic lease/transaction. Audit storage needs append-only server
// permissions and explicit retention. This report is NOT deletion approval.
