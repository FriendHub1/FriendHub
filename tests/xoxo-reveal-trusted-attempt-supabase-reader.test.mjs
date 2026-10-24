import test from 'node:test';
import assert from 'node:assert/strict';
import {createRevealTrustedAttemptReader} from '../supabase/functions/xoxo-reveal-upload/trusted-attempt-supabase-reader.mjs';
const id='attempt',sender='sender',fingerprint='a'.repeat(64);
function setup(row={id,sender_id:sender,payload_fingerprint:fingerprint,status:'pending'},error=null){
 const calls=[];
 const query={
  select:fields=>{calls.push(['select',fields]);return query;},
  eq:(key,value)=>{calls.push(['eq',key,value]);return query;},
  maybeSingle:async()=>({data:row,error})
 };
 const reader=createRevealTrustedAttemptReader({dbClient:{from:table=>{calls.push(['from',table]);return query;}}});
 return {reader,calls};
}
test('reads pending attempt with sender filter and exact fingerprint',async()=>{
 const {reader,calls}=setup();
 assert.deepEqual(await reader({attemptId:id,senderId:sender}),{authoritative:true,id,senderId:sender,payloadFingerprint:fingerprint});
 assert.deepEqual(calls.slice(0,4),[['from','xoxo_reveal_upload_attempts'],['select','id,sender_id,payload_fingerprint,status'],['eq','id',id],['eq','sender_id',sender]]);
});
test('rejects mismatched, completed and malformed attempts',async()=>{
 for(const patch of [{sender_id:'other'},{status:'completed'},{payload_fingerprint:'bad'},{id:'wrong'}]){
  const {reader}=setup({id,sender_id:sender,payload_fingerprint:fingerprint,status:'pending',...patch});
  await assert.rejects(()=>reader({attemptId:id,senderId:sender}),/unavailable/);
 }
});
test('missing row and database errors fail closed',async()=>{
 for(const [row,error] of [[null,null],[null,{message:'permission denied'}]]){
  const {reader}=setup(row,error);
  await assert.rejects(()=>reader({attemptId:id,senderId:sender}),/unavailable/);
 }
});
test('invalid input never reaches database',async()=>{
 const {reader,calls}=setup();
 await assert.rejects(()=>reader({attemptId:'',senderId:sender}),/Invalid attempt/);
 assert.deepEqual(calls,[]);
});
