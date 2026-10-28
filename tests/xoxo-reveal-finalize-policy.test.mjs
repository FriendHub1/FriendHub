import test from "node:test";
import assert from "node:assert/strict";
import {assessRevealUploadFinalization as assess} from "../supabase/functions/xoxo-reveal-upload/finalize-policy.mjs";
const base={
 senderId:"sender",claimToken:"owner-secret",revealId:"reveal",dmId:"dm",
 attempt:{sender_id:"sender",claim_token:"owner-secret",status:"pending"},
 linkedReveal:{id:"reveal",dm_id:"dm",sender_id:"sender",dm_sender_id:"sender",
 recipient_id:"recipient",dm_recipient_id:"recipient"}
};
test("valid owner and linked message may finalize",()=>{
 assert.deepEqual(assess(base),{allowed:true,reason:"can_finalize"});
});
test("wrong owner token or sender cannot finalize",()=>{
 assert.equal(assess({...base,claimToken:"stale"}).reason,"claim_owner_mismatch");
 assert.equal(assess({...base,senderId:"other"}).reason,"attempt_not_found");
});
test("completed same result is idempotent, different result rejected",()=>{
 const attempt={...base.attempt,status:"completed",reveal_id:"reveal",dm_id:"dm"};
 assert.equal(assess({...base,attempt}).reason,"already_completed");
 assert.equal(assess({...base,attempt,revealId:"other"}).reason,"completed_conflict");
});
test("failed or uncertain attempt cannot finalize",()=>{
 assert.equal(assess({...base,attempt:{...base.attempt,status:"needs_reconciliation"}}).allowed,false);
});
test("mismatched linked Reveal and DM is rejected",()=>{
 assert.equal(assess({...base,linkedReveal:{...base.linkedReveal,dm_recipient_id:"other"}}).reason,"linked_dm_mismatch");
});
