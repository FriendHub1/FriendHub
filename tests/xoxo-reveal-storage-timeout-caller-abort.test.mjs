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
 await upload({signal:controller.signal});
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
