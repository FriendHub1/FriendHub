import test from 'node:test';
import assert from 'node:assert/strict';
import {createRevealAuthenticatedReconciliationService} from '../supabase/functions/xoxo-reveal-upload/reconciliation-authenticated-service.mjs';
test('auth provider exception denies review before any private database read',async()=>{
 let reads=0;
 const review=createRevealAuthenticatedReconciliationService({
  supabase:{rpc:async()=>{reads++;return {data:true,error:null};},from(){reads++;throw Error('unexpected');}},
  authClient:{auth:{getUser:async()=>{throw Error('provider unavailable');}}},
  readIntegrity:async()=>{reads++;},
  readTrustedFingerprint:async()=>{reads++;}
 });
 await assert.rejects(()=>review({attemptId:'a',accessToken:'token'}),/not authenticated/);
 assert.equal(reads,0);
});
