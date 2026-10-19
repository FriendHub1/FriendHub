import test from 'node:test';
import assert from 'node:assert/strict';
import {createRevealDurableUncertaintyUploadService} from '../supabase/functions/xoxo-reveal-upload/durable-uncertainty-upload-service.mjs';
import {createRevealLeaseAwareUploadCoordinator} from '../supabase/functions/xoxo-reveal-upload/lease-aware-upload-coordinator.mjs';

// Two independent server instances share only an authoritative atomic writer
// claim. This is a contract test, not a substitute for a PostgreSQL concurrency
// test or a durable fence for in-flight external Storage writes.
test('two instances cannot both write when beginWriter atomically grants one owner',async()=>{
 let owner=null,storageWrites=0,markers=0;
 let releaseWrite;
 const waiting=new Promise(resolve=>{releaseWrite=resolve;});
 const database={from(){return {select(){return this;},eq(){return this;},
  async maybeSingle(){return {data:{id:'a',sender_id:'s',status:'pending',upload_uncertain_at:null},error:null};}
 };}};
 const make=(token)=>createRevealDurableUncertaintyUploadService({
  dbClient:database,
  rpcClient:{rpc:async()=>{markers++;return {data:true};}},
  uploadAndSeal:createRevealLeaseAwareUploadCoordinator({
   beginWriter:async({writerToken})=>{
    if(owner!==null)return false;
    owner=writerToken;return true;
   },
   renewWriter:async({writerToken})=>owner===writerToken,
   uploadPrivate:async()=>{storageWrites++;await waiting;return {created:true,objectPath:'private/a'};},
   sealWriter:async({writerToken})=>owner===writerToken
  })
 });
 const first=make('first');
 const second=make('second');
 const firstRun=first.run({attemptId:'a',senderId:'s',writerToken:'first'});
 // Wait for the first claim to be established without relying on timers.
 for(let i=0;i<10&&owner===null;i++)await Promise.resolve();
 assert.equal(owner,'first');
 await assert.rejects(second.run({attemptId:'a',senderId:'s',writerToken:'second'}),/Writer begin denied/);
 assert.equal(storageWrites,1);
 releaseWrite();
 assert.equal((await firstRun).sealed,true);
 assert.equal(storageWrites,1);
 // Definitive pre-write denial must not poison the successful owner's attempt.
 assert.equal(markers,0);
});
