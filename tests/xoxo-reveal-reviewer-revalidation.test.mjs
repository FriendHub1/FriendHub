import test from 'node:test';
import assert from 'node:assert/strict';
import {createRevealReconciliationReviewerAuthorizer} from '../supabase/functions/xoxo-reveal-upload/reconciliation-reviewer-authorizer.mjs';
test('reviewer is checked again after admin permission lookup',async()=>{
 let reads=0;
 const authorize=createRevealReconciliationReviewerAuthorizer({
  authClient:{auth:{getUser:async()=>{reads++;return {data:{user:{id:'admin'}},error:null};}}},
  adminLookup:async()=>true
 });
 assert.equal(await authorize({attemptId:'a',reviewerId:'admin',accessToken:'token'}),true);
 assert.equal(reads,2);
});
test('revoked token after admin lookup denies review',async()=>{
 let reads=0;
 const authorize=createRevealReconciliationReviewerAuthorizer({
  authClient:{auth:{getUser:async()=>++reads===1?
   {data:{user:{id:'admin'}},error:null}:{data:null,error:{message:'revoked'}}}},
  adminLookup:async()=>true
 });
 assert.equal(await authorize({attemptId:'a',reviewerId:'admin',accessToken:'token'}),false);
});
test('identity change between checks denies review',async()=>{
 let reads=0;
 const authorize=createRevealReconciliationReviewerAuthorizer({
  authClient:{auth:{getUser:async()=>({data:{user:{id:++reads===1?'admin':'other'}},error:null})}},
  adminLookup:async()=>true
 });
 assert.equal(await authorize({attemptId:'a',reviewerId:'admin',accessToken:'token'}),false);
});
