import test from 'node:test';
import assert from 'node:assert/strict';
import {createRevealPrivateStorageByteReader} from '../supabase/functions/xoxo-reveal-upload/private-storage-read-adapter.mjs';
import {createRevealPrivateStorageCreateOnlyWriter,createRevealWriterGatedPrivateStorageWriter} from '../supabase/functions/xoxo-reveal-upload/private-storage-write-adapter.mjs';
test('private Storage adapters reject ambiguous paths without touching Storage or authorization',async()=>{
 let storageCalls=0,authCalls=0;
 const storageClient={storage:{from(){storageCalls++;throw Error('should not access Storage');}}};
 const read=createRevealPrivateStorageByteReader({storageClient});
 const write=createRevealPrivateStorageCreateOnlyWriter({storageClient});
 const gated=createRevealWriterGatedPrivateStorageWriter({
  storageClient,authorizeActiveWriter:async()=>{authCalls++;return true;}
 });
 const args={bucket:'xoxo-reveal',bytes:new Uint8Array([1]),contentType:'image/png'};
 for(const objectPath of ['a//b','a/./b','a/../b','a/','/a']){
  await assert.rejects(read({bucket:'xoxo-reveal',objectPath}),TypeError);
  await assert.rejects(write({...args,objectPath}),TypeError);
  await assert.rejects(gated({...args,objectPath,attemptId:'a',senderId:'s',writerToken:'t'}),TypeError);
 }
 assert.equal(storageCalls,0);
 assert.equal(authCalls,0);
});

test('private Storage adapters reject malformed input containers without side effects',async()=>{
 let storageCalls=0,authCalls=0;
 const storageClient={storage:{from(){storageCalls++;throw Error('unexpected Storage call');}}};
 const read=createRevealPrivateStorageByteReader({storageClient});
 const write=createRevealPrivateStorageCreateOnlyWriter({storageClient});
 const gated=createRevealWriterGatedPrivateStorageWriter({
  storageClient,authorizeActiveWriter:async()=>{authCalls++;return true;}
 });
 for(const input of [null,1,'text',[]]){
  await assert.rejects(read(input),TypeError);
  await assert.rejects(write(input),TypeError);
  await assert.rejects(gated(input),TypeError);
 }
 assert.equal(storageCalls,0);
 assert.equal(authCalls,0);
});

test('private Storage reader sanitizes thrown download and byte conversion failures',async()=>{
 for(const stage of ['download','bytes']){
  const storageClient={storage:{from(){return {
   async download(){
    if(stage==='download')throw Error('secret storage details');
    return {data:{size:1,async arrayBuffer(){throw Error('secret bytes details');}},error:null};
   }
  };}}};
  const read=createRevealPrivateStorageByteReader({storageClient});
  await assert.rejects(read({bucket:'xoxo-reveal',objectPath:'private/a'}),error=>{
   assert.match(error.message,/Private Storage/);
   assert.equal(error.message.includes('secret'),false);
   return true;
  });
 }
});
