import test from 'node:test';
import assert from 'node:assert/strict';
import {createRevealPrivateStorageCreateOnlyWriter,createRevealWriterGatedPrivateStorageWriter} from '../supabase/functions/xoxo-reveal-upload/private-storage-write-adapter.mjs';
const bytes=new Uint8Array([1,2,3]);
test('blank path cannot reach direct private Storage upload',async()=>{
 let calls=0;
 const write=createRevealPrivateStorageCreateOnlyWriter({
  storageClient:{storage:{from:()=>{calls++;throw new Error('unexpected Storage call');}}}
 });
 await assert.rejects(write({bucket:'xoxo-reveal',objectPath:'  ',bytes,contentType:'image/png'}),TypeError);
 assert.equal(calls,0);
});
test('blank path cannot reach privileged writer authorization',async()=>{
 let authCalls=0,storageCalls=0;
 const write=createRevealWriterGatedPrivateStorageWriter({
  storageClient:{storage:{from:()=>{storageCalls++;throw new Error('unexpected Storage call');}}},
  authorizeActiveWriter:async()=>{authCalls++;return true;}
 });
 await assert.rejects(write({
  attemptId:'attempt',senderId:'sender',writerToken:'token',
  bucket:'xoxo-reveal',objectPath:'  ',bytes,contentType:'image/png'
 }),TypeError);
 assert.equal(authCalls,0);
 assert.equal(storageCalls,0);
});
