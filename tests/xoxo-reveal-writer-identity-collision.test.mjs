import test from 'node:test';
import assert from 'node:assert/strict';
import {createRevealExclusiveUploadCoordinator} from '../supabase/functions/xoxo-reveal-upload/exclusive-upload-coordinator.mjs';
import {createRevealLeaseAwareUploadCoordinator} from '../supabase/functions/xoxo-reveal-upload/lease-aware-upload-coordinator.mjs';
const a={senderId:'x:y',attemptId:'z',writerToken:'t'};
const b={senderId:'x',attemptId:'y:z',writerToken:'t'};
for(const [name,make] of [
 ['exclusive',()=>createRevealExclusiveUploadCoordinator({
  beginWriter:async()=>true,uploadPrivate:async()=>({created:true}),sealWriter:async()=>true
 })],
 ['lease-aware',()=>createRevealLeaseAwareUploadCoordinator({
  beginWriter:async()=>true,renewWriter:async()=>true,
  uploadPrivate:async()=>({created:true}),sealWriter:async()=>true
 })]
]){
 test(name+' keeps distinct compound writer identities separate',async()=>{
  const run=make();
  const [first,second]=await Promise.all([run(a),run(b)]);
  assert.equal(first.sealed,true);
  assert.equal(second.sealed,true);
 });
 test(name+' rejects malformed writer identity before privileged operations',async()=>{
  const run=make();
  await assert.rejects(run({senderId:4,attemptId:'a',writerToken:'t'}),TypeError);
  await assert.rejects(run({senderId:'s',attemptId:'a',writerToken:' '}),TypeError);
 });
}
