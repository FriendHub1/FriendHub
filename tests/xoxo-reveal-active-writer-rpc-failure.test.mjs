import test from 'node:test';
import assert from 'node:assert/strict';
import {createRevealActiveWriterSupabaseAuthorizer} from '../supabase/functions/xoxo-reveal-upload/active-writer-supabase-adapter.mjs';

const identity={attemptId:'attempt',senderId:'sender',writerToken:'writer'};
test('writer verification denies thrown RPC errors',async()=>{
 const authorize=createRevealActiveWriterSupabaseAuthorizer({
  rpcClient:{rpc:async()=>{throw new Error('network offline');}}
 });
 assert.equal(await authorize(identity),false);
});
test('writer verification accepts only exact true with no error',async()=>{
 let response={data:true,error:null};
 const authorize=createRevealActiveWriterSupabaseAuthorizer({
  rpcClient:{rpc:async()=>response}
 });
 assert.equal(await authorize(identity),true);
 for(const value of [1,'true',null,false]){
  response={data:value,error:null};
  assert.equal(await authorize(identity),false);
 }
 response={data:true,error:{message:'denied'}};
 assert.equal(await authorize(identity),false);
});
test('blank writer identity never calls RPC',async()=>{
 let calls=0;
 const authorize=createRevealActiveWriterSupabaseAuthorizer({
  rpcClient:{rpc:async()=>{calls++;return {data:true,error:null};}}
 });
 for(const bad of [{...identity,attemptId:' '},{...identity,senderId:' '},{...identity,writerToken:' '}]){
  assert.equal(await authorize(bad),false);
 }
 assert.equal(calls,0);
});
