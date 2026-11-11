import test from 'node:test';
import assert from 'node:assert/strict';
import {createRevealPrivateStorageByteReader} from '../supabase/functions/xoxo-reveal-upload/private-storage-read-adapter.mjs';
function setup({data={size:3,arrayBuffer:async()=>new Uint8Array([1,2,3]).buffer},error=null,maxBytes=5}={}){
 const calls=[];
 const storageClient={storage:{from:bucket=>{calls.push(['bucket',bucket]);return {download:async path=>{calls.push(['path',path]);return {data,error};}};}}};
 return {read:createRevealPrivateStorageByteReader({storageClient,maxBytes}),calls};
}
test('downloads bytes only from private Reveal bucket',async()=>{
 const {read,calls}=setup();
 assert.deepEqual([...await read({bucket:'xoxo-reveal',objectPath:'a/photo.webp'})],[1,2,3]);
 assert.deepEqual(calls,[['bucket','xoxo-reveal'],['path','a/photo.webp']]);
});
test('rejects public bucket and unsafe paths before network',async()=>{
 const {read,calls}=setup();
 for(const loc of [{bucket:'public',objectPath:'a/photo.webp'},{bucket:'xoxo-reveal',objectPath:'../photo.webp'},{bucket:'xoxo-reveal',objectPath:'a\\photo.webp'}])
  await assert.rejects(()=>read(loc),/Invalid private/);
 assert.equal(calls.length,0);
});
test('rejects oversized and empty private objects',async()=>{
 for(const data of [{size:99,arrayBuffer:async()=>new ArrayBuffer(99)},{size:0,arrayBuffer:async()=>new ArrayBuffer(0)}]){
  const {read}=setup({data});
  await assert.rejects(()=>read({bucket:'xoxo-reveal',objectPath:'a/photo.webp'}),/byte limit or is empty|exceeds byte limit/);
 }
});
test('download error fails closed',async()=>{
 const {read}=setup({data:null,error:{message:'forbidden'}});
 await assert.rejects(()=>read({bucket:'xoxo-reveal',objectPath:'a/photo.webp'}),/download unavailable/);
});
