import test from 'node:test';
import assert from 'node:assert/strict';
import {createRevealReconciliationStorageEvidence} from '../supabase/functions/xoxo-reveal-upload/reconciliation-storage-evidence.mjs';
const fingerprint='a'.repeat(64);
const input={attemptId:'a',senderId:'s',objectBinding:{attemptId:'a',senderId:'s',bucketId:'xoxo-reveal',objectPath:'a/photo.webp'}};
test('verified private bytes still cannot establish writer quiescence',async()=>{
 const read=createRevealReconciliationStorageEvidence({
  readTrustedFingerprint:async()=>fingerprint,
  readIntegrity:async()=>({authoritative:true,objectPath:'a/photo.webp',payloadFingerprint:fingerprint,exists:true,digestVerified:true})
 });
 assert.deepEqual(await read(input),{state:'present',digestMatches:true,writerQuiescent:false});
});
test('digest mismatch is surfaced without authorizing recovery',async()=>{
 const read=createRevealReconciliationStorageEvidence({
  readTrustedFingerprint:async()=>fingerprint,
  readIntegrity:async()=>({authoritative:true,objectPath:'a/photo.webp',payloadFingerprint:fingerprint,exists:true,digestVerified:false})
 });
 assert.deepEqual(await read(input),{state:'present',digestMatches:false,writerQuiescent:false});
});
test('untrusted binding prevents private Storage read',async()=>{
 let called=false;
 const read=createRevealReconciliationStorageEvidence({
  readTrustedFingerprint:async()=>{called=true;return fingerprint;},
  readIntegrity:async()=>{called=true;return {};}
 });
 assert.equal((await read({...input,objectBinding:{...input.objectBinding,senderId:'wrong'}})).state,'unavailable');
 assert.equal(called,false);
});
test('storage exceptions fail closed',async()=>{
 const read=createRevealReconciliationStorageEvidence({
  readTrustedFingerprint:async()=>fingerprint,
  readIntegrity:async()=>{throw Error('storage down');}
 });
 assert.deepEqual(await read(input),{state:'unavailable',digestMatches:false,writerQuiescent:false});
});
