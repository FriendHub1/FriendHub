import test from 'node:test';
import assert from 'node:assert/strict';
import {createRevealStorageUploadTimeoutGuard} from '../supabase/functions/xoxo-reveal-upload/storage-upload-timeout-guard.mjs';

test('caller abort rejects immediately even if remote Storage never settles',async()=>{
 const controller=new AbortController();
 let remoteSignal,clearCalls=0;
 const bounded=createRevealStorageUploadTimeoutGuard({
  uploadPrivate:async ({signal})=>{remoteSignal=signal;return new Promise(()=>{});},
  timeoutMs:30000,
  setTimeoutFn:()=>({fake:true}),
  clearTimeoutFn:()=>{clearCalls++;}
 });
 const pending=bounded({signal:controller.signal});
 await Promise.resolve();
 await Promise.resolve();
 controller.abort();
 await assert.rejects(pending,/aborted; reconciliation required/);
 assert.equal(remoteSignal.aborted,true);
 assert.equal(clearCalls,1);
});
