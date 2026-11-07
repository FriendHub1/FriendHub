import test from 'node:test';
import assert from 'node:assert/strict';
import {createRevealUploadUncertaintyGate} from '../supabase/functions/xoxo-reveal-upload/upload-uncertainty-gate.mjs';

test('different compound identities do not share uncertainty state',async()=>{
 const calls=[];
 const gate=createRevealUploadUncertaintyGate({
  uploadAndSeal:async({senderId})=>{
   calls.push(senderId);
   if(senderId==='x:y')throw new Error('ambiguous remote upload');
   return {created:true,sealed:true};
  },
  markUncertain:async()=>true
 });
 const a={senderId:'x:y',attemptId:'z'};
 const b={senderId:'x',attemptId:'y:z'};
 await assert.rejects(gate.run(a),/ambiguous/);
 assert.equal(gate.isUncertain(a),true);
 assert.equal(gate.isUncertain(b),false);
 assert.equal((await gate.run(b)).sealed,true);
 assert.deepEqual(calls,['x:y','x']);
});
test('uncertainty gate rejects malformed input without writing',async()=>{
 let writes=0;
 const gate=createRevealUploadUncertaintyGate({
  uploadAndSeal:async()=>{writes++;},
  markUncertain:async()=>true
 });
 for(const value of [null,42,'text',[],{}])
  await assert.rejects(gate.run(value),TypeError);
 assert.equal(writes,0);
 assert.equal(gate.isUncertain(null),false);
});
