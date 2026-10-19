import test from 'node:test';
import assert from 'node:assert/strict';
import {createRevealAuthenticatedReconciliationService} from '../supabase/functions/xoxo-reveal-upload/reconciliation-authenticated-service.mjs';
function supabase(calls,admin=false){
 return {rpc:async(name,args)=>{calls.push(['rpc',name,args]);return {data:admin,error:null};},
 from(table){calls.push(['from',table]);const q={select(){return q;},eq(){return q;},async maybeSingle(){return {data:null,error:null};}};return q;}};
}
test('token-derived reviewer must pass privileged admin RPC before any evidence read',async()=>{
 const calls=[];
 const review=createRevealAuthenticatedReconciliationService({
  supabase:supabase(calls,false),
  authClient:{auth:{getUser:async()=>({data:{user:{id:'member'}},error:null})}},
  readIntegrity:async()=>{throw Error('unexpected');},
  readTrustedFingerprint:async()=>{throw Error('unexpected');}
 });
 await assert.rejects(()=>review({attemptId:'a',accessToken:'token'}),/not authorized/);
 assert.equal(calls.some(([kind])=>kind==='from'),false);
 assert.equal(calls.filter(([kind])=>kind==='rpc').length,1);
});
test('missing or invalid auth token never accesses database',async()=>{
 const calls=[];
 const review=createRevealAuthenticatedReconciliationService({
  supabase:supabase(calls),
  authClient:{auth:{getUser:async()=>({data:{user:null},error:{message:'bad'}})}},
  readIntegrity:async()=>{},readTrustedFingerprint:async()=>{}
 });
 await assert.rejects(()=>review({attemptId:'a',accessToken:'invalid'}),/not authenticated/);
 await assert.rejects(()=>review({attemptId:'a'}),/access token required/);
 assert.deepEqual(calls,[]);
});
test('verified administrator may inspect but not mutate evidence',async()=>{
 const calls=[];
 const review=createRevealAuthenticatedReconciliationService({
  supabase:supabase(calls,true),
  authClient:{auth:{getUser:async()=>({data:{user:{id:'admin'}},error:null})}},
  readIntegrity:async()=>{},readTrustedFingerprint:async()=>{}
 });
 assert.deepEqual(await review({attemptId:'a',accessToken:'valid'}),{action:'manual_review',reason:'missing_attempt'});
 assert.equal(calls.some(([kind])=>kind==='from'),true);
});
