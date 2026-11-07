import test from 'node:test';
import assert from 'node:assert/strict';
import {createRevealReconciliationReviewerAuthorizer} from '../supabase/functions/xoxo-reveal-upload/reconciliation-reviewer-authorizer.mjs';
test('verified user and server-side admin approval authorize review',async()=>{
 const authorize=createRevealReconciliationReviewerAuthorizer({
  authClient:{auth:{getUser:async token=>({data:{user:{id:token==='valid'?'admin':'other'}},error:null})}},
  adminLookup:async({userId})=>userId==='admin'
 });
 assert.equal(await authorize({attemptId:'a',reviewerId:'admin',accessToken:'valid'}),true);
 assert.equal(await authorize({attemptId:'a',reviewerId:'admin',accessToken:'invalid'}),false);
});
test('browser-provided reviewer ID cannot impersonate admin',async()=>{
 let checked=false;
 const authorize=createRevealReconciliationReviewerAuthorizer({
  authClient:{auth:{getUser:async()=>({data:{user:{id:'member'}},error:null})}},
  adminLookup:async()=>{checked=true;return true;}
 });
 assert.equal(await authorize({attemptId:'a',reviewerId:'admin',accessToken:'token'}),false);
 assert.equal(checked,false);
});
test('auth failures and non-true admin results fail closed',async()=>{
 const authorize=createRevealReconciliationReviewerAuthorizer({
  authClient:{auth:{getUser:async()=>({data:{user:{id:'admin'}},error:null})}},
  adminLookup:async()=>({admin:true})
 });
 assert.equal(await authorize({attemptId:'a',reviewerId:'admin',accessToken:'token'}),false);
 const broken=createRevealReconciliationReviewerAuthorizer({
  authClient:{auth:{getUser:async()=>{throw Error('offline');}}},
  adminLookup:async()=>true
 });
 assert.equal(await broken({attemptId:'a',reviewerId:'admin',accessToken:'token'}),false);
});
