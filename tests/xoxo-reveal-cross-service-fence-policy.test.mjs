import test from 'node:test';
import assert from 'node:assert/strict';
import {assessRevealCrossServiceFence as check} from '../supabase/functions/xoxo-reveal-upload/cross-service-fence-policy.mjs';
const attempt={id:'attempt-a',sender_id:'sender-a',payload_fingerprint:'a'.repeat(64),status:'failed'};
const fence={authoritative:true,active:true,attemptId:'attempt-a',senderId:'sender-a',token:'fence-1',writeLeaseRevoked:true,noActiveStorageWriter:true,noActiveDmWriter:true,noActiveFinalizer:true};
const storage={authoritative:true,checkedAfterFence:true,fenceToken:'fence-1',attemptId:'attempt-a',state:'absent'};
const linkedDm={...storage};
const quota={authoritative:true,checkedAfterFence:true,fenceToken:'fence-1',attemptId:'attempt-a',senderId:'sender-a',state:'reserved',reservationId:'quota-a'};
const base={attempt,fence,storage,linkedDm,quota};
test('matching fenced evidence is only eligible for atomic refund review',()=>{
 assert.deepEqual(check(base),{allowed:true,reason:'eligible_for_atomic_refund_review',attemptId:'attempt-a',reservationId:'quota-a',fenceToken:'fence-1'});
});
test('active or uncertain writer always blocks refund review',()=>{
 for(const field of ['writeLeaseRevoked','noActiveStorageWriter','noActiveDmWriter','noActiveFinalizer']){
  assert.equal(check({...base,fence:{...fence,[field]:false}}).allowed,false,field);
 }
});
test('stale fence or pre-fence reads fail closed',()=>{
 assert.equal(check({...base,storage:{...storage,fenceToken:'stale'}}).allowed,false);
 assert.equal(check({...base,linkedDm:{...linkedDm,checkedAfterFence:false}}).allowed,false);
 assert.equal(check({...base,quota:{...quota,authoritative:false}}).allowed,false);
});
test('Storage object or linked DM blocks refund',()=>{
 assert.equal(check({...base,storage:{...storage,state:'present'}}).allowed,false);
 assert.equal(check({...base,linkedDm:{...linkedDm,state:'present'}}).allowed,false);
});
test('unknown and mismatched identities fail closed',()=>{
 assert.equal(check({...base,storage:{...storage,state:'unknown'}}).allowed,false);
 assert.equal(check({...base,quota:{...quota,senderId:'other'}}).allowed,false);
 assert.equal(check({...base,fence:{...fence,attemptId:'other'}}).allowed,false);
});
test('completed, pending, and uncertain attempts cannot refund',()=>{
 for(const status of ['completed','pending','needs_reconciliation'])
  assert.equal(check({...base,attempt:{...attempt,status}}).allowed,false);
});
