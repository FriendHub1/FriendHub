import test from 'node:test';
import assert from 'node:assert/strict';
import {createRevealWriterGatedPrivateStorageWriter} from '../supabase/functions/xoxo-reveal-upload/private-storage-write-adapter.mjs';

test('malformed Storage requests never reach privileged authorization',async()=>{
 let authorizations=0,uploads=0;
 const write=createRevealWriterGatedPrivateStorageWriter({
  storageClient:{storage:{from:()=>({upload:async()=>{uploads++;return {data:{path:'ok'},error:null};}})}},
  authorizeActiveWriter:async()=>{authorizations++;return true;}
 });
 const valid={attemptId:'attempt',senderId:'sender',writerToken:'writer',bucket:'xoxo-reveal',
  objectPath:'sender/object.webp',bytes:new Uint8Array([1]),contentType:'image/webp'};
 for(const bad of [
  {...valid,writerToken:' '},
  {...valid,senderId:7},
  {...valid,bucket:'public'},
  {...valid,objectPath:'sender\\object.webp'},
  {...valid,objectPath:'../object.webp'},
  {...valid,bytes:new Uint8Array()},
  {...valid,bytes:new Uint8Array(15728641)},
  {...valid,contentType:'text/html'}
 ])await assert.rejects(write(bad),TypeError);
 assert.equal(authorizations,0);
 assert.equal(uploads,0);
 await write(valid);
 assert.equal(authorizations,1);
 assert.equal(uploads,1);
});

test('custom maximum bytes is checked before writer grant',async()=>{
 let grants=0;
 const write=createRevealWriterGatedPrivateStorageWriter({
  storageClient:{storage:{from:()=>({upload:async()=>({data:{path:'ok'},error:null})})}},
  authorizeActiveWriter:async()=>{grants++;return true;},
  maxBytes:2
 });
 const input={attemptId:'attempt',senderId:'sender',writerToken:'writer',bucket:'xoxo-reveal',
  objectPath:'sender/file.webp',bytes:new Uint8Array([1,2,3]),contentType:'image/webp'};
 await assert.rejects(write(input),TypeError);
 assert.equal(grants,0);
 await write({...input,bytes:new Uint8Array([1,2])});
 assert.equal(grants,1);
});
