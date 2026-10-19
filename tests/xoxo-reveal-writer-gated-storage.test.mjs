import test from 'node:test';
import assert from 'node:assert/strict';
import {createRevealWriterGatedPrivateStorageWriter} from '../supabase/functions/xoxo-reveal-upload/private-storage-write-adapter.mjs';
const base={attemptId:'a',senderId:'s',writerToken:'private',bucket:'xoxo-reveal',objectPath:'a/file.webp',bytes:new Uint8Array([1]),contentType:'image/webp'};
function setup(allow){
 const calls=[];
 const storageClient={storage:{from:bucket=>({upload:async(path,bytes,opts)=>{calls.push({bucket,path,opts});return {data:{path},error:null};}})}};
 return {writer:createRevealWriterGatedPrivateStorageWriter({storageClient,authorizeActiveWriter:async()=>allow}),calls};
}
test('active trusted lease permits create-only upload',async()=>{
 const {writer,calls}=setup(true);
 assert.equal((await writer(base)).created,true);
 assert.equal(calls.length,1);
 assert.equal(calls[0].opts.upsert,false);
});
test('denied or missing writer authorization never touches Storage',async()=>{
 for(const allow of [false,null,undefined]){
  const {writer,calls}=setup(allow);
  await assert.rejects(()=>writer(base),/denied/);
  assert.equal(calls.length,0);
 }
});
test('missing trusted token blocks Storage even if callback permits',async()=>{
 const {writer,calls}=setup(true);
 await assert.rejects(()=>writer({...base,writerToken:null}),/Missing trusted/);
 assert.equal(calls.length,0);
});
