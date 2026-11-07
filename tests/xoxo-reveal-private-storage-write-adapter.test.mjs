import test from 'node:test';
import assert from 'node:assert/strict';
import {createRevealPrivateStorageCreateOnlyWriter} from '../supabase/functions/xoxo-reveal-upload/private-storage-write-adapter.mjs';
function setup({data={path:'a/p.webp'},error=null}={}){
 const calls=[];
 const storageClient={storage:{from:bucket=>{calls.push(['bucket',bucket]);return {upload:async(path,bytes,opts)=>{calls.push(['upload',path,bytes,opts]);return {data,error};}};}}};
 return {upload:createRevealPrivateStorageCreateOnlyWriter({storageClient,maxBytes:5}),calls};
}
test('writes only to private bucket with upsert disabled',async()=>{
 const {upload,calls}=setup(),bytes=new Uint8Array([1,2,3]);
 assert.deepEqual(await upload({bucket:'xoxo-reveal',objectPath:'a/p.webp',bytes,contentType:'image/webp'}),{objectPath:'a/p.webp',created:true});
 assert.deepEqual(calls[0],['bucket','xoxo-reveal']);
 assert.equal(calls[1][3].upsert,false);
 assert.equal(calls[1][3].contentType,'image/webp');
});
test('rejects wrong bucket, unsafe path, oversized and unsupported media',async()=>{
 const {upload,calls}=setup(),base={bucket:'xoxo-reveal',objectPath:'a/p.webp',bytes:new Uint8Array([1]),contentType:'image/webp'};
 for(const patch of [{bucket:'public'},{objectPath:'../p.webp'},{bytes:new Uint8Array(6)},{contentType:'text/html'}])
  await assert.rejects(()=>upload({...base,...patch}),/Invalid|Unsupported/);
 assert.equal(calls.length,0);
});
test('Storage conflict or failure is not treated as success',async()=>{
 const {upload}=setup({data:null,error:{message:'already exists'}});
 await assert.rejects(()=>upload({bucket:'xoxo-reveal',objectPath:'a/p.webp',bytes:new Uint8Array([1]),contentType:'image/webp'}),/failed/);
});
