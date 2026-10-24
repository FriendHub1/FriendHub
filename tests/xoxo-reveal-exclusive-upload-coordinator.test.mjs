import test from 'node:test';
import assert from 'node:assert/strict';
import {createRevealExclusiveUploadCoordinator} from '../supabase/functions/xoxo-reveal-upload/exclusive-upload-coordinator.mjs';
const input={attemptId:'a',senderId:'s',writerToken:'secret',objectPath:'a/p.webp'};
test('successful upload seals only after Storage confirms creation',async()=>{
 const events=[];
 const run=createRevealExclusiveUploadCoordinator({
  beginWriter:async()=>{events.push('begin');return true;},
  uploadPrivate:async()=>{events.push('upload');return {created:true,objectPath:input.objectPath};},
  sealWriter:async()=>{events.push('seal');return true;}
 });
 assert.deepEqual(await run(input),{created:true,sealed:true,objectPath:input.objectPath});
 assert.deepEqual(events,['begin','upload','seal']);
});
test('failed upload never seals writer',async()=>{
 let sealed=false;
 const run=createRevealExclusiveUploadCoordinator({
  beginWriter:async()=>true,uploadPrivate:async()=>{throw Error('storage down');},
  sealWriter:async()=>{sealed=true;return true;}
 });
 await assert.rejects(()=>run(input),/storage down/);
 assert.equal(sealed,false);
});
test('concurrent same-attempt uploads are rejected within one process',async()=>{
 let release;
 const waiting=new Promise(resolve=>{release=resolve;});
 const run=createRevealExclusiveUploadCoordinator({
  beginWriter:async()=>true,
  uploadPrivate:async()=>{await waiting;return {created:true,objectPath:input.objectPath};},
  sealWriter:async()=>true
 });
 const first=run(input);
 await assert.rejects(()=>run(input),/already in flight/);
 release();
 assert.equal((await first).sealed,true);
});
test('writer begin denial does not attempt upload or seal',async()=>{
 let calls=0;
 const run=createRevealExclusiveUploadCoordinator({
  beginWriter:async()=>false,uploadPrivate:async()=>{calls++;},
  sealWriter:async()=>{calls++;}
 });
 await assert.rejects(()=>run(input),/begin denied/);
 assert.equal(calls,0);
});
