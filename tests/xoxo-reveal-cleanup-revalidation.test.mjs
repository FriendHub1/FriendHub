import test from "node:test";
import assert from "node:assert/strict";
import {assessRevealDeletion} from "../supabase/xoxo-reveal-cleanup-revalidation.mjs";
const now=new Date("2026-10-19T12:00:00Z");
const reveal={id:"r",object_path:"private/r.webp",mode:"timed",expires_at:"2026-10-19T09:00:00Z"};
test("allows old expired reveal with no active session or holds",()=>{
 assert.deepEqual(assessRevealDeletion({reveal,now}),{allowed:true,reason:"expired_and_unheld"});
});
test("never deletes keep-mode reveal",()=>{
 assert.equal(assessRevealDeletion({reveal:{...reveal,mode:"keep"},now}).allowed,false);
});
test("moderation reports and legal holds deny cleanup",()=>{
 for(const flag of ["hasOpenReport","hasModerationHold","hasLegalHold"]){
  assert.deepEqual(assessRevealDeletion({reveal,now,[flag]:true}),{allowed:false,reason:"retention_hold"});
 }
});
test("active or invalid sessions deny cleanup",()=>{
 assert.equal(assessRevealDeletion({reveal:{...reveal,session_expires_at:"2026-10-19T11:30:00Z"},now}).allowed,false);
 assert.equal(assessRevealDeletion({reveal:{...reveal,session_expires_at:"invalid"},now}).allowed,false);
});
test("recent expiry and missing expiry deny cleanup",()=>{
 assert.equal(assessRevealDeletion({reveal:{...reveal,expires_at:"2026-10-19T11:45:00Z"},now}).allowed,false);
 assert.equal(assessRevealDeletion({reveal:{...reveal,expires_at:null},now}).allowed,false);
});
