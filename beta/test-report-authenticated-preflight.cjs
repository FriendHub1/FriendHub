"use strict";
const assert=require("node:assert/strict");
const {authenticatedReportPreflight}=require("./report-authenticated-preflight.cjs");
const self="44444444-4444-4444-8444-444444444444";
const peer="33333333-3333-4333-8333-333333333333";
const outsider="55555555-5555-4555-8555-555555555555";
const msg="22222222-2222-4222-8222-222222222221";
const payload={otherUserId:peer,messageIds:[msg]};
function client({user=self,authError=null,rows=[{id:msg,sender_id:peer,recipient_id:self}],dbError=null}={}){
 return {
  auth:{getUser:async()=>({data:{user:user?{id:user}:null},error:authError})},
  from:table=>{
   assert.equal(table,"direct_messages");
   return {select:fields=>{
    assert.equal(fields,"id,sender_id,recipient_id");
    return {in:async(key,ids)=>{
     assert.equal(key,"id");
     assert.deepEqual(ids,[msg]);
     return {data:rows,error:dbError};
    }};
   }};
  }
 };
}
(async()=>{
 const tests=[
  ["valid user",client(),payload,true],
  ["missing user",client({user:null}),payload,false],
  ["auth failure",client({authError:{message:"invalid token"}}),payload,false],
  ["wrong conversation",client({rows:[{id:msg,sender_id:outsider,recipient_id:self}]}),payload,false],
  ["cleared or invisible",client({rows:[]}),payload,false],
  ["db failure",client({dbError:{message:"access denied"}}),payload,false],
  ["self report",client(),{otherUserId:self,messageIds:[msg]},false],
  ["malformed evidence",client(),{otherUserId:peer,messageIds:["bad"]},false],
 ];
 for(const [name,c,input,expected] of tests){
  const result=await authenticatedReportPreflight(c,input);
  assert.equal(result.ok,expected,name);
 }
 assert.equal((await authenticatedReportPreflight(null,payload)).ok,false);
 console.log("PASS: 9 authenticated preflight mock scenarios");
})().catch(e=>{console.error(e);process.exitCode=1;});
