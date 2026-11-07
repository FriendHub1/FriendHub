import test from "node:test";
import assert from "node:assert/strict";
import {assessRefundRetryOutcome as assess} from "../supabase/functions/xoxo-reveal-upload/refund-retry-outcome-policy.mjs";
const ids={attemptId:"attempt-a",senderId:"sender-a",reservationId:"quota-a"};
const released={...ids,authoritative:true,status:"released",releaseCommitted:true};
const active={...ids,authoritative:true,status:"active",releaseCommitted:false,attemptStatus:"failed",storageAbsentVerified:true,dmAbsentVerified:true,noInFlightOperations:true};
test("returns confirmed release without executing another refund",()=>{
 assert.equal(assess({...ids,record:released}).action,"return_existing");
});
test("permits only fenced re-evaluation of verified active reservation",()=>{
 assert.equal(assess({...ids,record:active}).action,"retry_inside_new_fenced_transaction");
});
test("rejects mismatched sender, attempt and reservation",()=>{
 for(const changed of [{senderId:"other"},{attemptId:"other"},{reservationId:"other"}])
  assert.equal(assess({...ids,record:{...released,...changed}}).action,"manual_reconciliation");
});
test("rejects uncertain commit or conflicting release state",()=>{
 for(const changed of [{status:"pending"},{releaseCommitted:null},{releaseCommitted:false}])
  assert.equal(assess({...ids,record:{...released,...changed}}).action,"manual_reconciliation");
});
test("rejects missing absence proofs and concurrent operations",()=>{
 for(const changed of [{storageAbsentVerified:false},{dmAbsentVerified:false},{noInFlightOperations:false},{attemptStatus:"pending"}])
  assert.equal(assess({...ids,record:{...active,...changed}}).action,"manual_reconciliation");
});
test("rejects unauthoritative records",()=>{
 assert.equal(assess({...ids,record:{...released,authoritative:false}}).action,"manual_reconciliation");
});
