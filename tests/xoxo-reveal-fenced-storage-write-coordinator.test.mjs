import test from 'node:test';
import assert from 'node:assert/strict';
import {executeFencedRevealStorageWrite as run} from '../supabase/functions/xoxo-reveal-upload/fenced-storage-write-coordinator.mjs';
const ctx={attemptId:'a',senderId:'s',writerToken:'t'};
const setup=()=>{const calls=[];return {calls,dependencies:{
 ...ctx,
 claimWriter:async()=>{calls.push('claim');return 'claimed';},
 verifyWriter:async({phase})=>{calls.push(phase);return true;},
 uploadPrivateObject:async()=>{calls.push('upload');return {stored:true};},
 markNeedsReconciliation:async()=>{calls.push('quarantine');}
}}};
test('claims and checks durable writer both sides of Storage write',async()=>{
 const {calls,dependencies}=setup();
 const result=await run(dependencies);
 assert.equal(result.ok,true);
 assert.deepEqual(calls,['claim','before_upload','upload','after_upload']);
});
test('second writer refused before touching Storage',async()=>{
 const {calls,dependencies}=setup();
 const result=await run({...dependencies,claimWriter:async()=> 'busy'});
 assert.equal(result.ok,false);
 assert.deepEqual(calls,[]);
});
test('failed preflight never writes Storage',async()=>{
 const {calls,dependencies}=setup();
 const result=await run({...dependencies,verifyWriter:async()=>false});
 assert.equal(result.ok,false);
 assert.deepEqual(calls,['claim']);
});
test('ambiguous upload failure quarantines rather than refunding',async()=>{
 const {calls,dependencies}=setup();
 const result=await run({...dependencies,uploadPrivateObject:async()=>{calls.push('upload');throw Error('timeout');}});
 assert.equal(result.reason,'storage_write_uncertain_manual_reconciliation');
 assert.deepEqual(calls,['claim','before_upload','upload','quarantine']);
});
test('lost writer ownership after upload triggers quarantine',async()=>{
 const {calls,dependencies}=setup();
 const result=await run({...dependencies,verifyWriter:async({phase})=>{calls.push(phase);return phase==='before_upload';}});
 assert.equal(result.reason,'post_upload_writer_unverified_manual_reconciliation');
 assert.deepEqual(calls,['claim','before_upload','upload','after_upload','quarantine']);
});
test('failed quarantine never reports success',async()=>{
 const {dependencies}=setup();
 const result=await run({...dependencies,uploadPrivateObject:async()=>{throw Error('timeout');},markNeedsReconciliation:async()=>{throw Error('db down');}});
 assert.equal(result.reason,'storage_write_uncertain_and_quarantine_failed');
});
test('invalid dependencies fail closed',async()=>{
 assert.deepEqual(await run(ctx),{ok:false,reason:'invalid_writer_context'});
});

test('Storage SDK error-shaped response never counts as success',async()=>{
 const {calls,dependencies}=setup();
 const result=await run({...dependencies,uploadPrivateObject:async()=>{
  calls.push('upload');return {data:null,error:{message:'permission denied'}};
 }});
 assert.equal(result.reason,'storage_ack_missing_manual_reconciliation');
 assert.deepEqual(calls,['claim','before_upload','upload','quarantine']);
});
test('undefined Storage response quarantines without post-upload verification',async()=>{
 const {calls,dependencies}=setup();
 const result=await run({...dependencies,uploadPrivateObject:async()=>{
  calls.push('upload');return undefined;
 }});
 assert.equal(result.ok,false);
 assert.deepEqual(calls,['claim','before_upload','upload','quarantine']);
});
