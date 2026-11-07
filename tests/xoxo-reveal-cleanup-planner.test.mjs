import test from "node:test";
import assert from "node:assert/strict";
import {planRevealCleanup} from "../supabase/xoxo-reveal-cleanup-planner.mjs";
const now=new Date("2026-10-19T12:00:00Z");
const reveal=(id,more={})=>({id,object_path:id+".webp",mode:"timed",expires_at:"2026-10-19T09:00:00Z",...more});
test("lists expired temporary reveals without exposing object paths",()=>{
 const plan=planRevealCleanup({now,reveals:[reveal("old")]});
 assert.deepEqual(plan.expiredReveals,[{id:"old",reason:"expired",objectPathPresent:true}]);
 assert.equal(plan.dryRun,true);
 assert.doesNotMatch(JSON.stringify(plan),/old.webp/);
});
test("never proposes keep-mode or unexpired reveals",()=>{
 const plan=planRevealCleanup({now,reveals:[
   reveal("kept",{mode:"keep"}),
   reveal("future",{expires_at:"2026-10-19T15:00:00Z"})
 ]});
 assert.equal(plan.expiredReveals.length,0);
});
test("defers active viewing sessions and grace periods",()=>{
 const plan=planRevealCleanup({now,reveals:[
   reveal("active",{session_expires_at:"2026-10-19T11:30:00Z"}),
   reveal("recent",{expires_at:"2026-10-19T11:45:00Z"})
 ]});
 assert.equal(plan.expiredReveals.length,0);
 assert.equal(plan.deferredReveals.length,2);
});
test("flags old unreleased reservations but never deletes",()=>{
 const plan=planRevealCleanup({now,reservations:[
   {id:"old",created_at:"2026-10-01T00:00:00Z",released_at:null},
   {id:"new",created_at:"2026-10-18T00:00:00Z",released_at:null},
   {id:"released",created_at:"2026-10-01T00:00:00Z",released_at:"2026-10-02T00:00:00Z"}
 ]});
 assert.deepEqual(plan.staleReservations,[{id:"old",reason:"older_than_retention"}]);
 assert.equal(plan.requiresManualReview,true);
});
