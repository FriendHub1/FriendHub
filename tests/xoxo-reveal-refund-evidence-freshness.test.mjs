import test from "node:test";
import assert from "node:assert/strict";
import {assessRefundEvidenceFreshness as assess} from "../supabase/functions/xoxo-reveal-upload/refund-evidence-freshness.mjs";
const nowMs=Date.parse("2026-10-19T12:00:00Z");
const evidence={
 authoritative:true,checkedAt:"2026-10-19T11:59:55Z",
 snapshotConsistent:true,attemptLocked:true,quotaLocked:true,
 storageRecheckedAfterFence:true
};
test("accepts recent authoritative evidence with all fences",()=>{
 assert.equal(assess({evidence,nowMs}).allowed,true);
});
test("rejects old or future evidence",()=>{
 assert.equal(assess({evidence:{...evidence,checkedAt:"2026-10-19T11:00:00Z"},nowMs}).allowed,false);
 assert.equal(assess({evidence:{...evidence,checkedAt:"2026-10-19T12:00:01Z"},nowMs}).allowed,false);
});
test("rejects unknown or untrusted snapshots",()=>{
 for(const changed of [{authoritative:false},{snapshotConsistent:false},{checkedAt:null}])
  assert.equal(assess({evidence:{...evidence,...changed},nowMs}).allowed,false);
});
test("requires attempt lock and quota lock",()=>{
 for(const changed of [{attemptLocked:false},{quotaLocked:false}])
  assert.equal(assess({evidence:{...evidence,...changed},nowMs}).allowed,false);
});
test("requires Storage recheck after transaction fence",()=>{
 assert.equal(assess({evidence:{...evidence,storageRecheckedAfterFence:false},nowMs}).allowed,false);
});
test("rejects invalid clock and excessive age threshold",()=>{
 assert.equal(assess({evidence,nowMs:NaN}).allowed,false);
 assert.equal(assess({evidence,nowMs,maxAgeMs:120000}).allowed,false);
});
