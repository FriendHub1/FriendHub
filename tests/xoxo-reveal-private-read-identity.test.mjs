import test from 'node:test';
import assert from 'node:assert/strict';
import {createRevealPrivateStorageByteReader} from '../supabase/functions/xoxo-reveal-upload/private-storage-read-adapter.mjs';
import {createRevealStorageIntegrityReader} from '../supabase/functions/xoxo-reveal-upload/storage-integrity-reader.mjs';

test('blank Storage read paths never reach download',async()=>{
 let calls=0;
 const reader=createRevealPrivateStorageByteReader({
  storageClient:{storage:{from:()=>{calls++;throw new Error('unexpected');}}}
 });
 await assert.rejects(reader({bucket:'xoxo-reveal',objectPath:'  '}),TypeError);
 assert.equal(calls,0);
});
test('invalid integrity identities never resolve trusted binding',async()=>{
 let calls=0;
 const reader=createRevealStorageIntegrityReader({
  resolveObjectBinding:async()=>{calls++;throw new Error('unexpected');},
  readPrivateBytes:async()=>{throw new Error('unexpected');},
  sha256:async()=>{throw new Error('unexpected');}
 });
 for(const input of [
  {attemptId:' ',objectPath:'safe/object',payloadFingerprint:'a'.repeat(64)},
  {attemptId:17,objectPath:'safe/object',payloadFingerprint:'a'.repeat(64)},
  {attemptId:'attempt',objectPath:' ',payloadFingerprint:'a'.repeat(64)}
 ])
  await assert.rejects(reader(input),TypeError);
 assert.equal(calls,0);
});
