import test from 'node:test';
import assert from 'node:assert/strict';
import {createRevealUploadUncertaintyGate} from '../supabase/functions/xoxo-reveal-upload/upload-uncertainty-gate.mjs';
import {createRevealLeaseAwareUploadCoordinator} from '../supabase/functions/xoxo-reveal-upload/lease-aware-upload-coordinator.mjs';
import {createRevealStorageUploadTimeoutGuard} from '../supabase/functions/xoxo-reveal-upload/storage-upload-timeout-guard.mjs';

test('timed-out remote upload stays unreconciled, never seals, and local retry is blocked',async()=>{
 let remoteResolve,started,sealCalls=0,beginCalls=0,marks=0,storageCalls=0;
 const remoteStarted=new Promise(resolve=>{started=resolve;});
 let fireTimeout;
 const guarded=createRevealStorageUploadTimeoutGuard({
  uploadPrivate:async()=>{storageCalls++;started();return new Promise(resolve=>{remoteResolve=resolve;});},
  timeoutMs:1000,
  setTimeoutFn:callback=>{fireTimeout=callback;return 1;},
  clearTimeoutFn:()=>{}
 });
 const coordinator=createRevealLeaseAwareUploadCoordinator({
  beginWriter:async()=>{beginCalls++;return true;},
  renewWriter:async()=>true,
  uploadPrivate:async ctx=>guarded(ctx),
  sealWriter:async()=>{sealCalls++;return true;}
 });
 const gate=createRevealUploadUncertaintyGate({
  uploadAndSeal:coordinator,
  markUncertain:async()=>{marks++;return true;}
 });
 const input={attemptId:'attempt',senderId:'sender',writerToken:'writer'};
 const pending=gate.run(input);
 await remoteStarted;
 fireTimeout();
 await assert.rejects(pending,/timed out; reconciliation required/);
 assert.equal(gate.isUncertain(input),true);
 assert.equal(marks,1);
 assert.equal(sealCalls,0);
 await assert.rejects(gate.run(input),/requires reconciliation/);
 assert.equal(beginCalls,1);
 assert.equal(storageCalls,1);
 // Even a late successful remote write is not evidence of a safe seal.
 remoteResolve({created:true,objectPath:'private/object'});
 await Promise.resolve();
 assert.equal(sealCalls,0);
});
