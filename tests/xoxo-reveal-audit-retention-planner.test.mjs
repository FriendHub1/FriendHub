import test from "node:test";
import assert from "node:assert/strict";
import {planRevealAuditRetention} from "../supabase/xoxo-reveal-audit-retention-planner.mjs";
const now=new Date("2026-10-19T12:00:00Z");
const old={id:1,reveal_id:"123e4567-e89b-12d3-a456-426614174000",
 occurred_at:"2026-06-01T12:00:00Z"};
const clear=()=>({openReport:false,moderationHold:false,legalHold:false});
test("flags only old unheld audit rows for manual review",()=>{
 const result=planRevealAuditRetention({events:[old],now,getHoldStatus:clear});
 assert.equal(result.dryRun,true);
 assert.equal(result.requiresApproval,true);
 assert.deepEqual(result.candidates,[{id:1,reason:"past_retention_no_holds"}]);
});
test("keeps records within 90 days",()=>{
 const result=planRevealAuditRetention({events:[{...old,occurred_at:"2026-10-01T00:00:00Z"}],
  now,getHoldStatus:clear});
 assert.equal(result.candidates.length,0);
 assert.equal(result.deferred[0].reason,"within_retention");
});
test("holds from reports, moderation or legal process prevent purge",()=>{
 for(const key of ["openReport","moderationHold","legalHold"]){
  const result=planRevealAuditRetention({events:[old],now,
   getHoldStatus:()=>({...clear(),[key]:true})});
  assert.equal(result.candidates.length,0);
  assert.equal(result.deferred[0].reason,"retention_hold");
 }
});
test("unknown or failed hold checks defer conservatively",()=>{
 const result=planRevealAuditRetention({events:[old],now,
  getHoldStatus:()=>{throw new Error("database unavailable");}});
 assert.equal(result.deferred[0].reason,"hold_status_unknown");
});
test("rejects oversized batches and invalid retention settings",()=>{
 assert.throws(()=>planRevealAuditRetention({events:Array(501).fill(old),getHoldStatus:clear}),/Invalid audit batch/);
 assert.throws(()=>planRevealAuditRetention({events:[old],retentionDays:0,getHoldStatus:clear}),/Invalid retention days/);
});
