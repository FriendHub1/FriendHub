import test from 'node:test';
import assert from 'node:assert/strict';
import {createRevealVerifiedFinalizeFromReaders as create} from '../supabase/functions/xoxo-reveal-upload/verified-finalize-service.mjs';
const args={attemptId:'a',senderId:'s',claimToken:'c',revealId:'r',dmId:'d',objectPath:'a/photo.webp',payloadFingerprint:'f'.repeat(64)};
function setup({digestVerified=true,authorizedAtLink=true,quotaActive=true}={}){
 const calls=[];
 const finalize=create({
  readAttempt:async()=>({authoritative:true,id:'a',senderId:'s',payloadFingerprint:args.payloadFingerprint}),
  readRevealDm:async()=>({authoritative:true,attemptId:'a',revealId:'r',dmId:'d',senderId:'s',objectPath:args.objectPath,payloadFingerprint:args.payloadFingerprint,authorizedAtLink,recipientMatches:true}),
  readStorageIntegrity:async()=>({authoritative:true,objectPath:args.objectPath,payloadFingerprint:args.payloadFingerprint,exists:true,digestVerified}),
  readQuota:async()=>({authoritative:true,attemptId:'a',senderId:'s',active:quotaActive}),
  readWriter:async()=>({authoritative:true,attemptId:'a',senderId:'s',safeForFinalize:true}),
  rpcClient:{rpc:async(name)=>{calls.push(name);return {data:'completed',error:null};}}
 });
 return {finalize,calls};
}
test('five matching trusted readers permit finalize RPC',async()=>{
 const {finalize,calls}=setup();
 assert.equal((await finalize(args)).ok,true);
 assert.deepEqual(calls,['xoxo_reveal_finalize_upload_v2']);
});
test('missing Storage digest prevents finalize RPC',async()=>{
 const {finalize,calls}=setup({digestVerified:false});
 assert.equal((await finalize(args)).ok,false);
 assert.deepEqual(calls,[]);
});
test('revoked DM authorization prevents finalize RPC',async()=>{
 const {finalize,calls}=setup({authorizedAtLink:false});
 assert.equal((await finalize(args)).ok,false);
 assert.deepEqual(calls,[]);
});
test('released quota prevents finalize RPC',async()=>{
 const {finalize,calls}=setup({quotaActive:false});
 assert.equal((await finalize(args)).ok,false);
 assert.deepEqual(calls,[]);
});
