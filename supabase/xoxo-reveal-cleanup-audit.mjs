// XOXO Reveal BETA — privacy-preserving cleanup audit events, NOT DEPLOYED.
// Produces sanitized event data only; it does NOT persist records or delete files.
const ACTIONS=new Set(["candidate_reviewed","cleanup_deferred","cleanup_eligible","cleanup_failed","cleanup_completed"]);
const REASONS=new Set([
 "expired_and_unheld","retention_hold","keep_mode","session_active_or_unknown",
 "not_expired_with_grace","no_valid_expiry","missing_record","storage_error",
 "db_error","manual_review"
]);
export function createRevealCleanupAuditEvent({
 revealId,action,reason,now=new Date(),operationId
}={}){
 if(typeof revealId!=="string"||!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(revealId))
   throw new TypeError("Valid Reveal UUID required");
 if(!ACTIONS.has(action)||!REASONS.has(reason))throw new TypeError("Invalid audit action or reason");
 if(typeof operationId!=="string"||!/^[a-zA-Z0-9_-]{8,100}$/.test(operationId))
   throw new TypeError("Invalid operation identifier");
 const time=now instanceof Date?now.getTime():NaN;
 if(!Number.isFinite(time))throw new TypeError("Invalid audit time");
 return Object.freeze({
  eventType:"xoxo_reveal_cleanup",revealId,action,reason,
  operationId,occurredAt:new Date(time).toISOString(),schemaVersion:1
 });
}
// No object paths, media content, emails, user identifiers, tokens or raw
// exception strings are stored in the event. Real audit persistence must be
// server-only, append-only, access-controlled and retention-limited.
