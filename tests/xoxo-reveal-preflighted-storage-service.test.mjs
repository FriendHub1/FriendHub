import test from 'node:test';
import assert from 'node:assert/strict';
import {createPreflightedRevealStorageService as create} from '../supabase/functions/xoxo-reveal-upload/preflighted-storage-service.mjs';
const bytes=new Uint8Array([82,73,70,70,0,0,0,0,87,69,66,80,86,80,56,32]);
const args={attemptId:'attempt',senderId:'sender',recipientId:'recipient',claimToken:'claim',writerToken:'writer',bytes,contentType:'image/webp',mode:'once',seconds:null};
function setup({allowed=true,path='attempt/file.webp'}={}){
 const calls=[];
 const send=create({
  authorizeDm:async()=>{calls.push('dm');return allowed;},
  resolveServerObjectPath:async()=>{calls.push('path');return path;},
  sendStorage:async data=>{calls.push('storage');return {ok:true,data};}
 });
 return {send,calls};
}
test('valid WebP and authorized DM proceed with server path',async()=>{
 const {send,calls}=setup();
 const result=await send(args);
 assert.equal(result.ok,true);
 assert.equal(result.data.objectPath,'attempt/file.webp');
 assert.equal(result.data.contentType,'image/webp');
 assert.deepEqual(calls,['dm','path','storage']);
});
test('spoofed MIME or unsupported bytes fail before DM and Storage',async()=>{
 const {send,calls}=setup();
 assert.equal((await send({...args,contentType:'video/mp4'})).reason,'invalid_media');
 assert.equal((await send({...args,bytes:new Uint8Array([1,2,3])})).reason,'invalid_media');
 assert.deepEqual(calls,[]);
});
test('mutual block or missing DM acceptance prevents Storage',async()=>{
 const {send,calls}=setup({allowed:false});
 assert.equal((await send(args)).reason,'dm_not_authorized');
 assert.deepEqual(calls,['dm']);
});
test('untrusted object path fails closed',async()=>{
 for(const path of ['../escape.webp','/absolute.webp','bad\\path','file?public=1']){
  const {send,calls}=setup({path});
  assert.equal((await send(args)).reason,'invalid_server_object_path');
  assert.equal(calls.includes('storage'),false);
 }
});
test('timed reveal requires supported duration',async()=>{
 const {send,calls}=setup();
 assert.equal((await send({...args,mode:'timed',seconds:30})).reason,'invalid_media');
 assert.deepEqual(calls,[]);
});
test('DM auth timeout fails closed',async()=>{
 const send=create({
  authorizeDm:async()=>{throw Error('timeout');},
  resolveServerObjectPath:async()=> 'safe',
  sendStorage:async()=>{throw Error('should not run');}
 });
 assert.equal((await send(args)).reason,'dm_authorization_uncertain');
});
