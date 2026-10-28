import test from 'node:test';
import assert from 'node:assert/strict';
import {createRevealReconciliationSupabaseReaders} from '../supabase/functions/xoxo-reveal-upload/reconciliation-supabase-readers.mjs';
import {createRevealReconciliationReviewerAuthorizer} from '../supabase/functions/xoxo-reveal-upload/reconciliation-reviewer-authorizer.mjs';

test('invalid reconciliation reader identifiers do not query tables',async()=>{
 let calls=0;
 const readers=createRevealReconciliationSupabaseReaders({supabase:{from(){calls++;throw new Error('unexpected DB read');}}});
 for(const attemptId of [null,12,' ',''])
  await assert.rejects(readers.readAttempt({attemptId}),TypeError);
 for(const input of [{attemptId:' ',senderId:'sender'},{attemptId:'attempt',senderId:0}])
  await assert.rejects(readers.readObjectBinding(input),TypeError);
 assert.equal(calls,0);
});
test('invalid reviewer identities do not call auth or admin lookup',async()=>{
 let authCalls=0,adminCalls=0;
 const authorize=createRevealReconciliationReviewerAuthorizer({
  authClient:{auth:{getUser:async()=>{authCalls++;return {data:{user:{id:'admin'}},error:null};}}},
  adminLookup:async()=>{adminCalls++;return true;}
 });
 for(const input of [
  {attemptId:' ',reviewerId:'admin',accessToken:'token'},
  {attemptId:'attempt',reviewerId:42,accessToken:'token'},
  {attemptId:'attempt',reviewerId:'admin',accessToken:' '}
 ])
  assert.equal(await authorize(input),false);
 assert.equal(authCalls,0);
 assert.equal(adminCalls,0);
});
