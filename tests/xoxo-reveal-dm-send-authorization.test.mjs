import test from 'node:test';
import assert from 'node:assert/strict';
import {createRevealDmSendAuthorizer} from '../supabase/functions/xoxo-reveal-upload/trusted-dm-send-authorization.mjs';
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
const input={senderId:a,recipientId:b,authenticatedSenderId:a};
function setup({blocks=[],messages=[],requests=[],errorTable=null}={}){
 const calls=[];
 const dbClient={from(table){
  calls.push(table);
  return {
   select(){return this;},or(){return this;},eq(){return this;},
   async limit(){return {data:table===errorTable?null:
    table==='user_blocks'?blocks:table==='direct_messages'?messages:requests,
    error:table===errorTable?{message:'unavailable'}:null};}
  };
 }};
 return {verify:createRevealDmSendAuthorizer({dbClient}),calls};
}
test('prior DM permits send when neither side blocked',async()=>{
 const {verify,calls}=setup({messages:[{id:'prior'}]});
 assert.equal(await verify(input),true);
 assert.deepEqual(calls,['user_blocks','direct_messages','user_blocks']);
});
test('accepted request permits send without prior DM',async()=>{
 const {verify}=setup({requests:[{id:'accepted'}]});
 assert.equal(await verify(input),true);
});
test('no existing DM or accepted request denies',async()=>{
 assert.equal(await setup().verify(input),false);
});
test('either-direction block denies even with existing DM',async()=>{
 for(const blocked of [{blocker_id:a,blocked_id:b},{blocker_id:b,blocked_id:a}]){
  const {verify,calls}=setup({blocks:[blocked],messages:[{id:'prior'}]});
  assert.equal(await verify(input),false);
  assert.deepEqual(calls,['user_blocks']);
 }
});
test('identity mismatch and filter injection reject before DB access',async()=>{
 for(const patch of [{authenticatedSenderId:b},{senderId:'bad,filter'},{recipientId:a},null]){
  const {verify,calls}=setup({messages:[{id:'prior'}]});
  if(patch===null)await assert.rejects(verify(null),TypeError);
  else assert.equal(await verify({...input,...patch}),false);
  assert.deepEqual(calls,[]);
 }
});
test('database failure denies authorization',async()=>{
 for(const errorTable of ['user_blocks','direct_messages','message_requests']){
  const {verify}=setup({errorTable});
  assert.equal(await verify(input),false);
 }
});

test('block appearing during relationship lookup denies before returning',async()=>{
 let reads=0;
 const dbClient={from(table){
  return {select(){return this;},or(){return this;},eq(){return this;},
   async limit(){
    if(table==='user_blocks')return {data:++reads===1?[]:[{id:'new-block'}],error:null};
    return {data:[{id:'prior'}],error:null};
   }};
 }};
 const verify=createRevealDmSendAuthorizer({dbClient});
 assert.equal(await verify(input),false);
 assert.equal(reads,2);
});
