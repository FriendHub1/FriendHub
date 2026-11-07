import test from "node:test";
import assert from "node:assert/strict";
import {reviewRevealCleanupBatch} from "../supabase/xoxo-reveal-cleanup-review.mjs";
const now=new Date("2026-10-19T12:00:00Z");
const operationId="cleanup_run_0001";
const reveal=(id)=>({id,object_path:"private/secret.webp",mode:"timed",
 expires_at:"2026-10-19T09:00:00Z"});
const a="123e4567-e89b-12d3-a456-426614174000";
const b="123e4567-e89b-12d3-a456-426614174001";
const noHolds=()=>({hasOpenReport:false,hasModerationHold:false,hasLegalHold:false});
test("produces audit events for eligible and held files without deleting",()=>{
 const result=reviewRevealCleanupBatch({
  reveals:[reveal(a),reveal(b)],now,operationId,
  getHolds:(id)=>({...noHolds(),hasOpenReport:id===b})
 });
 assert.equal(result.dryRun,true);
 assert.equal(result.eligible,1);
 assert.equal(result.deferred,1);
 assert.equal(result.events[1].reason,"retention_hold");
 assert.doesNotMatch(JSON.stringify(result),/private\/secret.webp/);
});
test("missing or failed hold checks always defer",()=>{
 const result=reviewRevealCleanupBatch({
  reveals:[reveal(a)],now,operationId,getHolds:()=>{throw new Error("DB unavailable");}
 });
 assert.equal(result.eligible,0);
 assert.equal(result.events[0].reason,"manual_review");
});
test("default hold lookup conservatively defers every file",()=>{
 const result=reviewRevealCleanupBatch({reveals:[reveal(a)],now,operationId});
 assert.equal(result.eligible,0);
});
test("rejects batches larger than 100",()=>{
 assert.throws(()=>reviewRevealCleanupBatch({
  reveals:Array.from({length:101},()=>reveal(a)),now,operationId,getHolds:noHolds
 }),/Invalid cleanup batch/);
});
