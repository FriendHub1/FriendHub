import test from "node:test";
import assert from "node:assert/strict";
import {evaluateRevealDmEligibility,REVEAL_DM_ELIGIBILITY_SQL} from "../supabase/functions/xoxo-reveal-upload/dm-eligibility.mjs";
const valid={authenticatedSenderId:"a",senderId:"a",recipientId:"b",
 hasExistingDmOrAcceptance:true,senderBlocksRecipient:false,recipientBlocksSender:false,
 senderIsSecretLetterTester:false,recipientIsSecretLetterTester:false,secretLetterMatched:false};
test("eligible accepted DM is allowed",()=>assert.equal(evaluateRevealDmEligibility(valid),true));
test("sender impersonation and self sends denied",()=>{
 assert.equal(evaluateRevealDmEligibility({...valid,authenticatedSenderId:"c"}),false);
 assert.equal(evaluateRevealDmEligibility({...valid,recipientId:"a"}),false);
});
test("either direction of blocking denies",()=>{
 assert.equal(evaluateRevealDmEligibility({...valid,senderBlocksRecipient:true}),false);
 assert.equal(evaluateRevealDmEligibility({...valid,recipientBlocksSender:true}),false);
});
test("no existing DM or acceptance denies",()=>assert.equal(evaluateRevealDmEligibility({...valid,hasExistingDmOrAcceptance:false}),false));
test("SQL review predicate retains critical checks",()=>{
 assert.match(REVEAL_DM_ELIGIBILITY_SQL,/auth\.uid\(\)/);
 assert.match(REVEAL_DM_ELIGIBILITY_SQL,/xoxo_has_existing_dm_or_acceptance/);
 assert.match(REVEAL_DM_ELIGIBILITY_SQL,/user_blocks/);
});
