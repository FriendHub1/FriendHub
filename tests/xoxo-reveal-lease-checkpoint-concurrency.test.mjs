import test from 'node:test';
import assert from 'node:assert/strict';
import {createRevealLeaseAwareUploadCoordinator} from '../supabase/functions/xoxo-reveal-upload/lease-aware-upload-coordinator.mjs';

const identity={attemptId:'attempt',senderId:'sender',writerToken:'writer'};
test('overlapping checkpoints serialize lease renewals',async()=>{
 let concurrent=0,maxConcurrent=0,renewals=0;
 const coordinator=createRevealLeaseAwareUploadCoordinator({
  beginWriter:async()=>true,
  renewWriter:async()=>{
   concurrent++;maxConcurrent=Math.max(maxConcurrent,concurrent);renewals++;
   await new Promise(resolve=>setImmediate(resolve));
   concurrent--;return true;
  },
  uploadPrivate:async({checkpoint})=>{
   await Promise.all([checkpoint(),checkpoint(),checkpoint()]);
   return {created:true,objectPath:'private/object'};
  },
  sealWriter:async()=>true
 });
 assert.deepEqual(await coordinator(identity),{created:true,sealed:true,objectPath:'private/object'});
 assert.equal(maxConcurrent,1);
 assert.equal(renewals,5);
});
test('failed concurrent renewal prevents sealing',async()=>{
 let renewals=0,seals=0;
 const coordinator=createRevealLeaseAwareUploadCoordinator({
  beginWriter:async()=>true,
  renewWriter:async()=>{renewals++;return renewals!==2;},
  uploadPrivate:async({checkpoint})=>{
   const results=await Promise.allSettled([checkpoint(),checkpoint()]);
   assert.equal(results.filter(result=>result.status==='rejected').length,2);
   return {created:true,objectPath:'private/object'};
  },
  sealWriter:async()=>{seals++;return true;}
 });
 await assert.rejects(coordinator(identity),/Writer lease already lost|Writer lease renewal failed/);
 assert.equal(seals,0);
 assert.equal(renewals,2);
});
test('invalid writer identity never begins a lease',async()=>{
 let begins=0;
 const coordinator=createRevealLeaseAwareUploadCoordinator({
  beginWriter:async()=>{begins++;return true;},
  renewWriter:async()=>true,
  uploadPrivate:async()=>({created:true}),
  sealWriter:async()=>true
 });
 for(const bad of [{...identity,writerToken:' '},{...identity,senderId:123},{...identity,attemptId:''}]){
  await assert.rejects(coordinator(bad),TypeError);
 }
 assert.equal(begins,0);
});

test('unawaited failing checkpoint prevents sealing',async()=>{
 let seals=0,renewals=0;
 const coordinator=createRevealLeaseAwareUploadCoordinator({
  beginWriter:async()=>true,
  renewWriter:async()=>{
   renewals++;
   if(renewals===2){
    await new Promise(resolve=>setImmediate(resolve));
    return false;
   }
   return true;
  },
  uploadPrivate:async({checkpoint})=>{
   // Intentionally fire-and-forget a checkpoint, with a rejection handler.
   checkpoint().catch(()=>{});
   return {created:true,objectPath:'private/object'};
  },
  sealWriter:async()=>{seals++;return true;}
 });
 await assert.rejects(coordinator(identity),/Writer lease already lost/);
 assert.equal(seals,0);
});

test('nested checkpoint failure cannot bypass final drain',async()=>{
 let renewals=0,seals=0;
 const coordinator=createRevealLeaseAwareUploadCoordinator({
  beginWriter:async()=>true,
  renewWriter:async()=>{
   renewals++;
   if(renewals===2){
    queueMicrotask(()=>pendingCheckpoint?.());
    return true;
   }
   return renewals!==3;
  },
  uploadPrivate:async({checkpoint})=>{
   pendingCheckpoint=()=>checkpoint().catch(()=>{});
   checkpoint().catch(()=>{});
   return {created:true,objectPath:'private/object'};
  },
  sealWriter:async()=>{seals++;return true;}
 });
 let pendingCheckpoint;
 await assert.rejects(coordinator(identity),/Writer lease already lost/);
 assert.equal(seals,0);
 assert.equal(renewals,3);
});
