import test from 'node:test';
import assert from 'node:assert/strict';
import {decideRevealUploadReconciliation as decide} from '../supabase/functions/xoxo-reveal-upload/upload-reconciliation-decision.mjs';
const attempt={id:'a',sender_id:'s',status:'pending',upload_uncertain_at:'2026-10-19T00:00:00Z'};
const binding={attemptId:'a',senderId:'s'};
test('unmarked attempts need no reconciliation',()=>{
 assert.equal(decide({attempt:{...attempt,upload_uncertain_at:null}}).action,'no_reconciliation');
});
test('missing or in-flight Storage never triggers automatic retry',()=>{
 for(const state of ['missing','unavailable']){
  const result=decide({attempt,objectBinding:binding,storageEvidence:{state}});
  assert.equal(result.action,'manual_review');
 }
});
test('verified bytes still require privileged human or policy resolution',()=>{
 const result=decide({attempt,objectBinding:binding,storageEvidence:{state:'present',digestMatches:true,writerQuiescent:true}});
 assert.deepEqual(result,{action:'manual_review',reason:'verified_object_requires_privileged_resolution'});
});
test('mismatched binding cannot clear uncertainty',()=>{
 const result=decide({attempt,objectBinding:{...binding,senderId:'other'},storageEvidence:{state:'present',digestMatches:true,writerQuiescent:true}});
 assert.equal(result.action,'manual_review');
});
