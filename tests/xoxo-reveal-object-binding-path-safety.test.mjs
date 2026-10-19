import test from 'node:test';
import assert from 'node:assert/strict';
import {createRevealTrustedObjectBindingReader} from '../supabase/functions/xoxo-reveal-upload/trusted-object-binding-supabase-reader.mjs';
import {createRevealStorageIntegrityReader} from '../supabase/functions/xoxo-reveal-upload/storage-integrity-reader.mjs';
const digest='a'.repeat(64);
test('persisted object binding rejects ambiguous paths before returning evidence',async()=>{
 for(const objectPath of ['a//b','a/./b','a/../b','a/']){
  const read=createRevealTrustedObjectBindingReader({dbClient:{from(){return {
   select(){return this;},eq(){return this;},async maybeSingle(){return {data:{
    attempt_id:'a',sender_id:'s',bucket_id:'xoxo-reveal',object_path:objectPath,
    payload_fingerprint:digest,expected_sha256:digest},error:null};}
  };}}});
  await assert.rejects(read({attemptId:'a'}),/Trusted object binding unavailable/);
 }
});
test('integrity reader rejects unsafe paths without accessing trusted dependencies',async()=>{
 let calls=0;
 const read=createRevealStorageIntegrityReader({
  resolveObjectBinding:async()=>{calls++;return null;},
  readPrivateBytes:async()=>{calls++;return new Uint8Array([1]);},
  sha256:async()=>{calls++;return digest;}
 });
 for(const objectPath of ['a//b','a/./b','a/../b','a/']){
  await assert.rejects(read({attemptId:'a',objectPath,payloadFingerprint:digest}),TypeError);
 }
 await assert.rejects(read(null),TypeError);
 assert.equal(calls,0);
});
