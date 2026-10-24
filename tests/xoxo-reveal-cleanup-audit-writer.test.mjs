import test from "node:test";
import assert from "node:assert/strict";
import {persistRevealCleanupAudit} from "../supabase/xoxo-reveal-cleanup-audit-writer.mjs";
const event={revealId:"123e4567-e89b-12d3-a456-426614174000",
 action:"cleanup_deferred",reason:"retention_hold",operationId:"cleanup_run_0001",
 occurredAt:"2026-10-19T12:00:00.000Z"};
test("saves only allowlisted sanitized audit fields",async()=>{
 let inserted;
 await persistRevealCleanupAudit({
  event:{...event,object_path:"secret/private.webp",email:"private@example.test"},
  insertAudit:async row=>{inserted=row;}
 });
 assert.equal(inserted.reveal_id,event.revealId);
 assert.equal(inserted.action,"cleanup_deferred");
 assert.doesNotMatch(JSON.stringify(inserted),/secret|private@example/);
});
test("requires a trusted server writer",async()=>{
 await assert.rejects(persistRevealCleanupAudit({event}),/Trusted audit writer/);
});
test("rejects unknown action before writing",async()=>{
 let called=false;
 await assert.rejects(persistRevealCleanupAudit({
  event:{...event,action:"erase_all"},
  insertAudit:async()=>{called=true;}
 }),/Invalid audit/);
 assert.equal(called,false);
});
test("propagates persistence errors for retry",async()=>{
 await assert.rejects(persistRevealCleanupAudit({
  event,insertAudit:async()=>{throw new Error("database unavailable");}
 }),/database unavailable/);
});
