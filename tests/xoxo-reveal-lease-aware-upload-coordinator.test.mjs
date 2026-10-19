import test from 'node:test';
import assert from 'node:assert/strict';
import {createRevealLeaseAwareUploadCoordinator} from '../supabase/functions/xoxo-reveal-upload/lease-aware-upload-coordinator.mjs';
const input={attemptId:'a',senderId:'s',writerToken:'t'};
test('renews before, during and after upload before sealing',async()=>{
 const events=[];
 const run=createRevealLeaseAwareUploadCoordinator({
  beginWriter:async()=>{events.push('begin');return true;},
  renewWriter:async()=>{events.push('renew');return true;},
  uploadPrivate:async({checkpoint})=>{events.push('upload');await checkpoint();return {created:true,objectPath:'a/p.webp'};},
  sealWriter:async()=>{events.push('seal');return true;}
 });
 assert.equal((await run(input)).sealed,true);
 assert.deepEqual(events,['begin','renew','upload','renew','renew','seal']);
});
test('lost lease during upload prevents sealing',async()=>{
 let renewals=0,seals=0;
 const run=createRevealLeaseAwareUploadCoordinator({
  beginWriter:async()=>true,
  renewWriter:async()=>++renewals<2,
  uploadPrivate:async({checkpoint})=>{await checkpoint();return {created:true};},
  sealWriter:async()=>{seals++;return true;}
 });
 await assert.rejects(()=>run(input),/renewal failed/);
 assert.equal(seals,0);
});
test('lost lease after upload prevents sealing',async()=>{
 let renewals=0,seals=0;
 const run=createRevealLeaseAwareUploadCoordinator({
  beginWriter:async()=>true,
  renewWriter:async()=>++renewals<2,
  uploadPrivate:async()=>({created:true}),
  sealWriter:async()=>{seals++;return true;}
 });
 await assert.rejects(()=>run(input),/renewal failed/);
 assert.equal(seals,0);
});
test('failed upload never seals and leaves reconciliation to server',async()=>{
 let seals=0;
 const run=createRevealLeaseAwareUploadCoordinator({
  beginWriter:async()=>true,renewWriter:async()=>true,
  uploadPrivate:async()=>{throw Error('Storage failed');},
  sealWriter:async()=>{seals++;return true;}
 });
 await assert.rejects(()=>run(input),/Storage failed/);
 assert.equal(seals,0);
});
