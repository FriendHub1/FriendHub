import test from 'node:test';
import assert from 'node:assert/strict';
import {createRevealPostUploadBindingGate} from '../supabase/functions/xoxo-reveal-upload/post-upload-binding-gate.mjs';
import {createRevealBindingEvidenceReader} from '../supabase/functions/xoxo-reveal-upload/binding-evidence-reader.mjs';
const base={attemptId:'attempt',senderId:'sender',claimToken:'claim',revealId:'reveal',dmId:'dm',objectPath:'private/object',payloadFingerprint:'a'.repeat(64)};
test('finalization rejects unsafe paths and invalid fingerprints before any side effect',async()=>{
 let reads=0,finalizations=0;
 const finalize=createRevealPostUploadBindingGate({
  readTrustedEvidence:async()=>{reads++;throw Error('unexpected');},
  finalizeAttempt:async()=>{finalizations++;throw Error('unexpected');}
 });
 for(const patch of [
  {objectPath:'  '},{objectPath:'../escape'},{objectPath:'/absolute'},
  {payloadFingerprint:'not-a-digest'},{claimToken:'  '},{dmId:' '}
 ]){
  assert.deepEqual(await finalize({...base,...patch}),{ok:false,reason:'invalid_binding_context'});
 }
 assert.equal(reads,0);assert.equal(finalizations,0);
});
test('binding aggregator rejects blank IDs before reading any privileged evidence',async()=>{
 let reads=0;
 const unexpected=async()=>{reads++;throw Error('unexpected');};
 const read=createRevealBindingEvidenceReader({
  readAttempt:unexpected,readRevealDm:unexpected,readStorageIntegrity:unexpected,
  readQuota:unexpected,readWriter:unexpected
 });
 for(const patch of [{senderId:'  '},{revealId:' '},{objectPath:'  '}])
  await assert.rejects(read({...base,...patch}),TypeError);
 assert.equal(reads,0);
});
