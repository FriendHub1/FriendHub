import test from 'node:test';
import assert from 'node:assert/strict';
import {createRevealPrivateStorageAdapter as create} from '../supabase/functions/xoxo-reveal-upload/private-storage-supabase-adapter.mjs';
const args={attemptId:'a',senderId:'s',writerToken:'w',objectPath:'attempt-a/file.webp',bytes:new Uint8Array([1,2,3]),contentType:'image/webp'};
function harness(result){
 const calls=[];
 const upload=create({storageClient:{storage:{from:(bucket)=>({
  upload:async(path,bytes,options)=>{calls.push({bucket,path,bytes,options});return result;}
 })}}});
 return {upload,calls};
}
test('uploads to private bucket without upsert and acknowledges exact path',async()=>{
 const {upload,calls}=harness({data:{path:args.objectPath},error:null});
 assert.deepEqual(await upload(args),{stored:true});
 assert.equal(calls.length,1);
 assert.equal(calls[0].bucket,'xoxo-reveal');
 assert.deepEqual(calls[0].options,{contentType:'image/webp',upsert:false});
});
test('Supabase error response is rejected',async()=>{
 const {upload}=harness({data:null,error:{message:'forbidden'}});
 await assert.rejects(()=>upload(args),/not acknowledged/);
});
test('mismatched or missing Storage path is rejected',async()=>{
 for(const response of [{data:{path:'other'},error:null},{data:{},error:null}]){
  const {upload}=harness(response);
  await assert.rejects(()=>upload(args),/not acknowledged/);
 }
});
test('invalid MIME and missing bytes fail before Storage',async()=>{
 const {upload,calls}=harness({data:{path:args.objectPath}});
 await assert.rejects(()=>upload({...args,contentType:'image/svg+xml'}),/Invalid/);
 await assert.rejects(()=>upload({...args,bytes:new Uint8Array()}),/Invalid/);
 assert.equal(calls.length,0);
});
test('nonprivate bucket cannot be configured',()=>{
 assert.throws(()=>create({storageClient:{storage:{from:()=>{}}},bucket:'public'}),/Trusted private/);
});

test('direct Storage adapter rejects oversized photo and video before upload',async()=>{
 const {upload,calls}=harness({data:{path:args.objectPath}});
 await assert.rejects(()=>upload({...args,bytes:new Uint8Array(900*1024+1)}),/size limit/);
 await assert.rejects(()=>upload({...args,bytes:new Uint8Array(15*1024*1024+1),contentType:'video/mp4'}),/size limit/);
 assert.equal(calls.length,0);
});
test('direct Storage adapter rejects non-byte-array payloads',async()=>{
 const {upload,calls}=harness({data:{path:args.objectPath}});
 await assert.rejects(()=>upload({...args,bytes:{byteLength:3}}),/Invalid/);
 assert.equal(calls.length,0);
});
