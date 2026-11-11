import test from 'node:test';
import assert from 'node:assert/strict';
import {createRevealPostUploadBindingGate as create} from '../supabase/functions/xoxo-reveal-upload/post-upload-binding-gate.mjs';
const args={attemptId:'attempt',senderId:'sender',claimToken:'claim',revealId:'reveal',dmId:'dm',objectPath:'attempt/photo.webp',payloadFingerprint:'f'.repeat(64)};
const verified={...args,authoritative:true,storageObjectVerified:true,storageDigestMatches:true,dmAuthorizedAtLink:true,recipientMatches:true,quotaReservationBound:true,writerStateSafe:true};
function harness(evidence=verified,result='completed'){
 const calls=[];
 const finalize=create({
  readTrustedEvidence:async()=>{calls.push('evidence');return evidence;},
  finalizeAttempt:async()=>{calls.push('finalize');return result;}
 });
 return {finalize,calls};
}
test('fully verified bindings permit trusted finalization',async()=>{
 const {finalize,calls}=harness();
 assert.deepEqual(await finalize(args),{ok:true,reason:'completed'});
 assert.deepEqual(calls,['evidence','finalize']);
});
test('missing Storage digest proof blocks finalization',async()=>{
 const {finalize,calls}=harness({...verified,storageDigestMatches:false});
 assert.equal((await finalize(args)).ok,false);
 assert.deepEqual(calls,['evidence']);
});
test('mismatched DM or private path blocks finalization',async()=>{
 for(const change of [{dmId:'wrong'},{objectPath:'wrong'},{payloadFingerprint:'a'.repeat(64)}]){
  const {finalize,calls}=harness({...verified,...change});
  assert.equal((await finalize(args)).reason,'binding_evidence_not_verified');
  assert.deepEqual(calls,['evidence']);
 }
});
test('stale DM authorization or unsafe writer blocks finalization',async()=>{
 for(const change of [{dmAuthorizedAtLink:false},{writerStateSafe:false},{quotaReservationBound:false}]){
  const {finalize,calls}=harness({...verified,...change});
  assert.equal((await finalize(args)).ok,false);
  assert.deepEqual(calls,['evidence']);
 }
});
test('unverified source or read failure never finalizes',async()=>{
 const {finalize,calls}=harness({...verified,authoritative:false});
 assert.equal((await finalize(args)).ok,false);
 assert.deepEqual(calls,['evidence']);
 const failing=create({readTrustedEvidence:async()=>{throw Error('offline');},finalizeAttempt:async()=>{throw Error('must not run');}});
 assert.equal((await failing(args)).reason,'binding_evidence_uncertain');
});
test('ambiguous finalize result requires reconciliation',async()=>{
 const {finalize}=harness(verified,'pending');
 assert.equal((await finalize(args)).reason,'finalize_not_confirmed');
});
test('already completed same binding is idempotent',async()=>{
 const {finalize}=harness(verified,'already_completed');
 assert.equal((await finalize(args)).ok,true);
});
