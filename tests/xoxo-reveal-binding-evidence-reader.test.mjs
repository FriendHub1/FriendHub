import test from 'node:test';
import assert from 'node:assert/strict';
import {createRevealBindingEvidenceReader as create} from '../supabase/functions/xoxo-reveal-upload/binding-evidence-reader.mjs';
const ctx={attemptId:'a',senderId:'s',revealId:'r',dmId:'d',objectPath:'a/photo.webp',payloadFingerprint:'f'.repeat(64)};
function setup(overrides={}){
 const calls=[];
 const values={
  attempt:{authoritative:true,id:'a',senderId:'s',payloadFingerprint:ctx.payloadFingerprint},
  link:{authoritative:true,attemptId:'a',revealId:'r',dmId:'d',senderId:'s',objectPath:ctx.objectPath,payloadFingerprint:ctx.payloadFingerprint,authorizedAtLink:true,recipientMatches:true},
  storage:{authoritative:true,objectPath:ctx.objectPath,payloadFingerprint:ctx.payloadFingerprint,exists:true,digestVerified:true},
  quota:{authoritative:true,attemptId:'a',senderId:'s',active:true},
  writer:{authoritative:true,attemptId:'a',senderId:'s',safeForFinalize:true},
  ...overrides
 };
 const reader=create({
  readAttempt:async()=>{calls.push('attempt');return values.attempt;},
  readRevealDm:async()=>{calls.push('link');return values.link;},
  readStorageIntegrity:async()=>{calls.push('storage');return values.storage;},
  readQuota:async()=>{calls.push('quota');return values.quota;},
  readWriter:async()=>{calls.push('writer');return values.writer;}
 });
 return {reader,calls};
}
test('requires five independently sourced matching records',async()=>{
 const {reader,calls}=setup();
 const result=await reader(ctx);
 assert.equal(result.authoritative,true);
 assert.equal(result.storageDigestMatches,true);
 assert.deepEqual(calls,['attempt','link','storage','quota','writer']);
});
test('wrong attempt fingerprint cannot be authoritative',async()=>{
 const {reader}=setup({attempt:{authoritative:true,id:'a',senderId:'s',payloadFingerprint:'wrong'}});
 assert.equal((await reader(ctx)).authoritative,false);
});
test('swapped DM sender or path cannot be authoritative',async()=>{
 for(const changes of [{senderId:'other'},{objectPath:'wrong'}]){
  const {reader}=setup({link:{authoritative:true,attemptId:'a',revealId:'r',dmId:'d',senderId:'s',objectPath:ctx.objectPath,payloadFingerprint:ctx.payloadFingerprint,authorizedAtLink:true,recipientMatches:true,...changes}});
  assert.equal((await reader(ctx)).authoritative,false);
 }
});
test('missing Storage digest is not proof of intact bytes',async()=>{
 const {reader}=setup({storage:{authoritative:true,objectPath:ctx.objectPath,payloadFingerprint:ctx.payloadFingerprint,exists:true,digestVerified:false}});
 assert.equal((await reader(ctx)).storageDigestMatches,false);
});
test('quota or writer mismatch cannot be authoritative',async()=>{
 for(const changes of [{quota:{authoritative:true,attemptId:'wrong',senderId:'s',active:true}},{writer:{authoritative:true,attemptId:'a',senderId:'wrong',safeForFinalize:true}}]){
  const {reader}=setup(changes);
  assert.equal((await reader(ctx)).authoritative,false);
 }
});
test('missing trusted dependency is rejected',()=>{
 assert.throws(()=>create({}),/Five trusted/);
});
