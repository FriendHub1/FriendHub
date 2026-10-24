import test from 'node:test';
import assert from 'node:assert/strict';
import {createRevealStorageUploadTimeoutGuard} from '../supabase/functions/xoxo-reveal-upload/storage-upload-timeout-guard.mjs';

test('pre-aborted caller never invokes Storage',async()=>{
 let calls=0;
 const controller=new AbortController();controller.abort();
 const upload=createRevealStorageUploadTimeoutGuard({uploadPrivate:async()=>{calls++;}});
 await assert.rejects(upload({signal:controller.signal}),/aborted; reconciliation required/);
 assert.equal(calls,0);
});
test('caller abort propagates advisory signal during Storage request',async()=>{
 const controller=new AbortController();
 let observed;
 const upload=createRevealStorageUploadTimeoutGuard({
  uploadPrivate:async({signal})=>{
   observed=signal;
   controller.abort();
   await new Promise(resolve=>setImmediate(resolve));
   return {created:true};
  }
 });
 await assert.rejects(upload({signal:controller.signal}),/aborted; reconciliation required/);
 assert.equal(observed.aborted,true);
});
test('timeout clears timer after successful upload',async()=>{
 let cleared=0;
 const upload=createRevealStorageUploadTimeoutGuard({
  uploadPrivate:async()=>({created:true}),
  setTimeoutFn:()=>42,
  clearTimeoutFn:id=>{assert.equal(id,42);cleared++;}
 });
 assert.deepEqual(await upload(),{created:true});
 assert.equal(cleared,1);
});

test('successful Storage response after caller cancellation is not accepted',async()=>{
 const controller=new AbortController();
 const upload=createRevealStorageUploadTimeoutGuard({
  uploadPrivate:async()=>{
   controller.abort();
   return {created:true};
  }
 });
 await assert.rejects(upload({signal:controller.signal}),/aborted; reconciliation required/);
});

test('caller abort remains latched even with mutable signal wrapper',async()=>{
 const listeners=new Set();
 const fakeSignal={
  aborted:false,
  addEventListener:(_name,callback)=>listeners.add(callback),
  removeEventListener:(_name,callback)=>listeners.delete(callback)
 };
 const upload=createRevealStorageUploadTimeoutGuard({
  uploadPrivate:async()=>{
   for(const callback of listeners)callback();
   return {created:true};
  }
 });
 await assert.rejects(upload({signal:fakeSignal}),/aborted; reconciliation required/);
 assert.equal(listeners.size,0);
});

test('abort occurring during signal listener registration prevents upload',async()=>{
 let calls=0,removed=0;
 const signal={
  aborted:false,
  addEventListener(_name,callback){this.aborted=true;callback();},
  removeEventListener(){removed++;}
 };
 const upload=createRevealStorageUploadTimeoutGuard({
  uploadPrivate:async()=>{calls++;return {created:true};}
 });
 await assert.rejects(upload({signal}),/aborted; reconciliation required/);
 assert.equal(calls,0);
 assert.equal(removed,1);
});
