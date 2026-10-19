// XOXO Reveal BETA — sanitized audit persistence adapter, NOT DEPLOYED.
// Caller must supply a trusted server-only insert implementation.
import {createRevealCleanupAuditEvent} from "./xoxo-reveal-cleanup-audit.mjs";

export async function persistRevealCleanupAudit({event,insertAudit}={}){
  if(typeof insertAudit!=="function")throw new TypeError("Trusted audit writer required");
  // Revalidate and allowlist every field; discard any extra/private fields.
  const clean=createRevealCleanupAuditEvent({
    revealId:event?.revealId,action:event?.action,reason:event?.reason,
    operationId:event?.operationId,now:new Date(event?.occurredAt)
  });
  await insertAudit({
    reveal_id:clean.revealId,operation_id:clean.operationId,
    event_type:clean.eventType,action:clean.action,reason:clean.reason,
    occurred_at:clean.occurredAt,schema_version:clean.schemaVersion
  });
  return {saved:true};
}
// No client credentials, database write or external connection in this module.
// Server writer must be restricted to INSERT and report failures for retry.
