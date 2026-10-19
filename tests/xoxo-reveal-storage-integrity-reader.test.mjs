import test from 'node:test';
import assert from 'node:assert/strict';
import {createRevealStorageIntegrityReader} from '../supabase/functions/xoxo-reveal-upload/storage-integrity-reader.mjs';
const fingerprint='a'.repeat(64),digest='b'.repeat(64);
const ctx={attemptId:'attempt',objectPath:'attempt/photo.webp',payloadFingerprint:fingerprint};
function harness(bindingPatch={},computedDigest=digest){
 const calls=[];
 const reader=createRevealStorageIntegrityReader({
  resolveObjectBinding:async()=>{calls.push('binding');return {authoritative:true,attemptId:ctx.attemptId,bucket:'xoxo-reveal',objectPath:ctx.objectPath,payloadFingerprint:fingerprint,expectedSha256:digest,...bindingPatch};},
  readPrivateBytes:async()=>{calls.push('bytes');return new Uint8Array([1,2,3]);},
  sha256:async()=>{calls.push('hash');return computedDigest;}
 });
 return {reader,calls};
}
test('matching server-owned SHA-256 of actual private bytes is verified',async()=>{
 const {reader,calls}=harness();
 assert.deepEqual(await reader(ctx),{authoritative:true,objectPath:ctx.objectPath,payloadFingerprint:fingerprint,exists:true,digestVerified:true});
 assert.deepEqual(calls,['binding','bytes','hash']);
});
test('different bytes digest cannot be marked verified',async()=>{
 const {reader}=harness({},'c'.repeat(64));
 assert.equal((await reader(ctx)).digestVerified,false);
});
test('untrusted or mismatched binding never downloads private bytes',async()=>{
 for(const patch of [{authoritative:false},{bucket:'public'},{objectPath:'other/photo.webp'},{payloadFingerprint:'c'.repeat(64)},{expectedSha256:null}]){
  const {reader,calls}=harness(patch);
  await assert.rejects(()=>reader(ctx),/binding unavailable/);
  assert.deepEqual(calls,['binding']);
 }
});
test('unsafe paths fail before server lookup',async()=>{
 for(const objectPath of ['../photo.webp','/photo.webp','folder\\photo.webp','photo.webp?x=1']){
  const {reader,calls}=harness();
  await assert.rejects(()=>reader({...ctx,objectPath}),/Invalid trusted/);
  assert.deepEqual(calls,[]);
 }
});
test('missing reader dependencies fail closed',()=>{
 assert.throws(()=>createRevealStorageIntegrityReader({}),/dependencies required/);
});
