import test from 'node:test';
import assert from 'node:assert/strict';
import {createRevealAuthenticatedDmSendAuthorizer} from '../supabase/functions/xoxo-reveal-upload/authenticated-dm-send-authorization.mjs';
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
function setup({userId=a,authError=null,authThrows=false,blocked=false}={}){
 const calls=[];
 const authClient={auth:{async getUser(){
  calls.push('auth');
  if(authThrows)throw new Error('auth offline');
  return {data:{user:userId?{id:userId}:null},error:authError};
 }}};
 const dbClient={from(table){
  calls.push(table);
  return {select(){return this;},or(){return this;},eq(){return this;},
   async limit(){return {error:null,data:table==='user_blocks'?(blocked?[{id:'block'}]:[]):[{id:'prior'}]};}};
 }};
 return {authorize:createRevealAuthenticatedDmSendAuthorizer({authClient,dbClient}),calls};
}
test('verified sender and existing conversation are authorized',async()=>{
 const {authorize,calls}=setup();
 assert.equal(await authorize({senderId:a,recipientId:b}),true);
 assert.deepEqual(calls,['auth','user_blocks','direct_messages','user_blocks']);
});
test('spoofed sender never reaches privileged database',async()=>{
 const {authorize,calls}=setup({userId:b});
 assert.equal(await authorize({senderId:a,recipientId:b,authenticatedSenderId:a}),false);
 assert.deepEqual(calls,['auth']);
});
test('missing session, auth error or exception fails closed',async()=>{
 for(const options of [{userId:null},{authError:{message:'invalid'}},{authThrows:true}]){
  const {authorize,calls}=setup(options);
  assert.equal(await authorize({senderId:a,recipientId:b}),false);
  assert.deepEqual(calls,['auth']);
 }
});
test('authenticated sender is denied when recipient blocks',async()=>{
 const {authorize,calls}=setup({blocked:true});
 assert.equal(await authorize({senderId:a,recipientId:b}),false);
 assert.deepEqual(calls,['auth','user_blocks']);
});
test('malformed request is rejected before authentication',async()=>{
 const {authorize,calls}=setup();
 await assert.rejects(authorize(null),TypeError);
 assert.deepEqual(calls,[]);
});

test('malformed authentication responses fail closed without database reads',async()=>{
 for(const response of [null,{}, {data:null}, {data:{user:null}}, {data:{user:{id:b}}}]){
  const calls=[];
  const authClient={auth:{async getUser(){calls.push('auth');return response;}}};
  const dbClient={from(){calls.push('db');throw new Error('must not query');}};
  const authorize=createRevealAuthenticatedDmSendAuthorizer({authClient,dbClient});
  assert.equal(await authorize({senderId:a,recipientId:b}),false);
  assert.deepEqual(calls,['auth']);
 }
});
