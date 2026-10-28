import test from 'node:test';
import assert from 'node:assert/strict';
import {createRevealTrustedObjectBindingReader} from '../supabase/functions/xoxo-reveal-upload/trusted-object-binding-supabase-reader.mjs';

function readerWithRow(row){
 const dbClient={from:()=>({
  select:()=>({eq:()=>({maybeSingle:async()=>({data:row,error:null})})})
 })};
 return createRevealTrustedObjectBindingReader({dbClient});
}
const valid={attempt_id:'attempt',sender_id:'sender',bucket_id:'xoxo-reveal',
 object_path:'private/object',payload_fingerprint:'a'.repeat(64),expected_sha256:'b'.repeat(64)};
test('persisted object binding rejects blank sender and object path',async()=>{
 for(const row of [
  {...valid,sender_id:'  '},
  {...valid,sender_id:42},
  {...valid,object_path:'  '}
 ])
  await assert.rejects(readerWithRow(row)({attemptId:'attempt'}),/Trusted object binding unavailable/);
});
test('persisted valid binding preserves authoritative digest evidence',async()=>{
 assert.deepEqual(await readerWithRow(valid)({attemptId:'attempt'}),{
  authoritative:true,attemptId:'attempt',bucket:'xoxo-reveal',
  objectPath:'private/object',payloadFingerprint:'a'.repeat(64),expectedSha256:'b'.repeat(64)
 });
});
