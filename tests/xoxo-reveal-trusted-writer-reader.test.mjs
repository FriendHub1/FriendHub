import test from 'node:test';
import assert from 'node:assert/strict';
import {createRevealTrustedWriterReader} from '../supabase/functions/xoxo-reveal-upload/trusted-writer-supabase-reader.mjs';
const ctx={attemptId:'a',senderId:'s'};
function setup(result={authoritative:true,attemptId:'a',senderId:'s',safeForFinalize:true}){
 const calls=[];
 const read=createRevealTrustedWriterReader({verifyWriterFence:async input=>{calls.push(input);return result;}});
 return {read,calls};
}
test('accepts exact authoritative durable writer evidence',async()=>{
 const {read,calls}=setup();
 assert.deepEqual(await read(ctx),{authoritative:true,attemptId:'a',senderId:'s',safeForFinalize:true});
 assert.deepEqual(calls,[ctx]);
});
test('unsafe writer remains unsafe',async()=>{
 const {read}=setup({authoritative:true,attemptId:'a',senderId:'s',safeForFinalize:false});
 assert.equal((await read(ctx)).safeForFinalize,false);
});
test('untrusted, swapped and incomplete fence evidence fails closed',async()=>{
 for(const patch of [{authoritative:false},{attemptId:'other'},{senderId:'other'},{safeForFinalize:null}]){
  const {read}=setup({authoritative:true,attemptId:'a',senderId:'s',safeForFinalize:true,...patch});
  await assert.rejects(()=>read(ctx),/unavailable/);
 }
});
test('invalid identifiers and missing verifier rejected',async()=>{
 assert.throws(()=>createRevealTrustedWriterReader({}),/verifier required/);
 const {read,calls}=setup();
 await assert.rejects(()=>read({attemptId:'',senderId:'s'}),/Invalid writer/);
 assert.deepEqual(calls,[]);
});
