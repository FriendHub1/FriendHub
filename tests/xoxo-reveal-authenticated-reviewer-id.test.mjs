import test from 'node:test';
import assert from 'node:assert/strict';
import {createRevealAuthenticatedReconciliationService} from '../supabase/functions/xoxo-reveal-upload/reconciliation-authenticated-service.mjs';

test('invalid token-derived reviewer IDs never reach privileged admin lookup or DB',async()=>{
 let rpcCalls=0,dbCalls=0,storageCalls=0;
 const service=createRevealAuthenticatedReconciliationService({
  supabase:{
   rpc:async()=>{rpcCalls++;return {data:true,error:null};},
   from:()=>{dbCalls++;throw Error('unexpected database access');}
  },
  authClient:{auth:{getUser:async()=>({data:{user:{id:'  '}},error:null})}},
  readIntegrity:async()=>{storageCalls++;throw Error('unexpected Storage read');},
  readTrustedFingerprint:async()=>{storageCalls++;throw Error('unexpected fingerprint read');}
 });
 await assert.rejects(service({attemptId:'attempt',accessToken:'token'}),/Reviewer not authenticated/);
 assert.equal(rpcCalls,0);assert.equal(dbCalls,0);assert.equal(storageCalls,0);
});
