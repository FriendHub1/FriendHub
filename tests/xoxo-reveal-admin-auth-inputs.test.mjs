import test from 'node:test';
import assert from 'node:assert/strict';
import {createRevealReconciliationAdminLookup} from '../supabase/functions/xoxo-reveal-upload/reconciliation-admin-lookup.mjs';
import {createRevealAuthenticatedReconciliationService} from '../supabase/functions/xoxo-reveal-upload/reconciliation-authenticated-service.mjs';

test('admin lookup rejects invalid user IDs without privileged RPC',async()=>{
 let calls=0;
 const lookup=createRevealReconciliationAdminLookup({rpcClient:{rpc:async()=>{calls++;return {data:true,error:null};}}});
 for(const userId of ['', ' ', 42, null])
  assert.equal(await lookup({userId}),false);
 assert.equal(calls,0);
 assert.equal(await lookup({userId:'admin'}),true);
 assert.equal(calls,1);
});
test('authenticated review rejects empty input before any auth or RPC call',async()=>{
 let authCalls=0,rpcCalls=0;
 const supabase={
  rpc:async()=>{rpcCalls++;return {data:false,error:null};},
  from:()=>{throw new Error('Unexpected database query');}
 };
 const authClient={auth:{getUser:async()=>{authCalls++;return {data:{user:{id:'admin'}},error:null};}}};
 const review=createRevealAuthenticatedReconciliationService({
  supabase,authClient,
  readIntegrity:async()=>{throw new Error('must not read');},
  readTrustedFingerprint:async()=>{throw new Error('must not read');}
 });
 for(const input of [
  {attemptId:' ',accessToken:'token'},
  {attemptId:'attempt',accessToken:' '},
  {attemptId:3,accessToken:'token'}
 ])
  await assert.rejects(review(input),TypeError);
 assert.equal(authCalls,0);
 assert.equal(rpcCalls,0);
});
