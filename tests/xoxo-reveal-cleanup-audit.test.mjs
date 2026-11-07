import test from "node:test";
import assert from "node:assert/strict";
import {createRevealCleanupAuditEvent} from "../supabase/xoxo-reveal-cleanup-audit.mjs";
const revealId="123e4567-e89b-12d3-a456-426614174000";
const base={revealId,action:"cleanup_deferred",reason:"retention_hold",
 operationId:"cleanup_run_0001",now:new Date("2026-10-19T12:00:00Z")};
test("creates a minimal immutable audit event",()=>{
 const event=createRevealCleanupAuditEvent(base);
 assert.equal(event.eventType,"xoxo_reveal_cleanup");
 assert.equal(event.reason,"retention_hold");
 assert.equal(event.occurredAt,"2026-10-19T12:00:00.000Z");
 assert.equal(Object.isFrozen(event),true);
});
test("does not include private media, sender or storage paths",()=>{
 const event=createRevealCleanupAuditEvent({...base,objectPath:"private/secret.webp",
  senderEmail:"private@example.test",token:"supersecret"});
 const value=JSON.stringify(event);
 assert.doesNotMatch(value,/secret|private|senderEmail|token/);
});
test("rejects unapproved audit actions and reasons",()=>{
 assert.throws(()=>createRevealCleanupAuditEvent({...base,action:"delete_everything"}),/Invalid audit/);
 assert.throws(()=>createRevealCleanupAuditEvent({...base,reason:"raw secret error"}),/Invalid audit/);
});
test("requires valid record and operation identifiers",()=>{
 assert.throws(()=>createRevealCleanupAuditEvent({...base,revealId:"../../../secrets"}),/Valid Reveal UUID/);
 assert.throws(()=>createRevealCleanupAuditEvent({...base,operationId:"bad id"}),/Invalid operation/);
});
