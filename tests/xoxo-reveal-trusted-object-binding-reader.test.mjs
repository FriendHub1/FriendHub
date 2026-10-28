import test from 'node:test';
import assert from 'node:assert/strict';
import {createRevealTrustedObjectBindingReader} from '../supabase/functions/xoxo-reveal-upload/trusted-object-binding-supabase-reader.mjs';
const row={attempt_id:'a',sender_id:'s',bucket_id:'xoxo-reveal',object_path:'a/photo.webp',payload_fingerprint:'f'.repeat(64),expected_sha256:'d'.repeat(64)};
function setup(data=row,error=null){
 const calls=[];
 const q={select:fields=>{calls.push(['select',fields]);return q;},eq:(key,value)=>{calls.push(['eq',key,value]);return q;},maybeSingle:async()=>({data,error})};
 return {read:createRevealTrustedObjectBindingReader({dbClient:{from:table=>{calls.push(['from',table]);return q;}}}),calls};
}
test('reads persisted SHA-256 from trusted object table',async()=>{
 const {read,calls}=setup();
 assert.deepEqual(await read({attemptId:'a'}),{authoritative:true,attemptId:'a',bucket:'xoxo-reveal',objectPath:'a/photo.webp',payloadFingerprint:row.payload_fingerprint,expectedSha256:row.expected_sha256});
 assert.deepEqual(calls[0],['from','xoxo_reveal_upload_objects']);
});
test('rejects invalid digest, fingerprint, path, bucket and attempt',async()=>{
 for(const patch of [{expected_sha256:'bad'},{payload_fingerprint:'bad'},{object_path:'../escape'},{bucket_id:'public'},{attempt_id:'other'}]){
  const {read}=setup({...row,...patch});
  await assert.rejects(()=>read({attemptId:'a'}),/unavailable/);
 }
});
test('missing row and DB errors fail closed',async()=>{
 for(const [data,error] of [[null,null],[null,{message:'denied'}]]){
  const {read}=setup(data,error);
  await assert.rejects(()=>read({attemptId:'a'}),/unavailable/);
 }
});
test('invalid input never queries Supabase',async()=>{
 const {read,calls}=setup();
 await assert.rejects(()=>read({attemptId:''}),/Invalid object/);
 assert.deepEqual(calls,[]);
});
