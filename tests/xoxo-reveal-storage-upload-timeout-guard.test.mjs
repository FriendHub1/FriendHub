import test from 'node:test';
import assert from 'node:assert/strict';
import {createRevealStorageUploadTimeoutGuard} from '../supabase/functions/xoxo-reveal-upload/storage-upload-timeout-guard.mjs';
test('successful bounded upload returns confirmation',async()=>{
 const run=createRevealStorageUploadTimeoutGuard({uploadPrivate:async()=>({created:true}),timeoutMs:1000});
 assert.deepEqual(await run({}),{created:true});
});
test('timeout aborts cooperatively and requires reconciliation',async()=>{
 let fire,signal;
 const run=createRevealStorageUploadTimeoutGuard({
  uploadPrivate:async input=>{signal=input.signal;return new Promise(()=>{});},
  timeoutMs:1000,
  setTimeoutFn:fn=>{fire=fn;return 1;},clearTimeoutFn:()=>{}
 });
 const pending=run({});
 await Promise.resolve();await Promise.resolve();
 fire();
 await assert.rejects(()=>pending,/timed out; reconciliation required/);
 assert.equal(signal.aborted,true);
});
test('invalid timeout cannot be configured',()=>{
 assert.throws(()=>createRevealStorageUploadTimeoutGuard({uploadPrivate:async()=>{},timeoutMs:1}),/Valid bounded/);
});
