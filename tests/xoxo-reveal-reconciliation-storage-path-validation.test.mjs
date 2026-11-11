import test from 'node:test';
import assert from 'node:assert/strict';
import {createRevealReconciliationStorageEvidence} from '../supabase/functions/xoxo-reveal-upload/reconciliation-storage-evidence.mjs';

test('unsafe private binding paths never reach fingerprint or Storage readers',async()=>{
 let reads=0;
 const read=createRevealReconciliationStorageEvidence({
  readIntegrity:async()=>{reads++;throw new Error('unexpected');},
  readTrustedFingerprint:async()=>{reads++;return 'a'.repeat(64);}
 });
 const base={attemptId:'attempt',senderId:'sender'};
 for(const objectPath of [' ','/root','../escape','folder\\secret','object?token','object#fragment']){
  assert.deepEqual(await read({...base,objectBinding:{
   ...base,bucketId:'xoxo-reveal',objectPath
  }}),{state:'unavailable',digestMatches:false,writerQuiescent:false});
 }
 assert.equal(reads,0);
});
test('valid binding is still read but never establishes writer quiescence',async()=>{
 let reads=0;
 const read=createRevealReconciliationStorageEvidence({
  readTrustedFingerprint:async()=>{reads++;return 'a'.repeat(64);},
  readIntegrity:async({objectPath,payloadFingerprint})=>{
   reads++;return {authoritative:true,exists:true,objectPath,payloadFingerprint,digestVerified:true};
  }
 });
 assert.deepEqual(await read({attemptId:'attempt',senderId:'sender',objectBinding:{
  attemptId:'attempt',senderId:'sender',bucketId:'xoxo-reveal',objectPath:'safe/object'
 }}),{state:'present',digestMatches:true,writerQuiescent:false});
 assert.equal(reads,2);
});
