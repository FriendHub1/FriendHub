"use strict";
const assert=require("node:assert/strict");
const {verifyVisibleMessages}=require("./report-rls-check.cjs");
const self="44444444-4444-4444-8444-444444444444";
const peer="33333333-3333-4333-8333-333333333333";
const other="55555555-5555-4555-8555-555555555555";
const a="22222222-2222-4222-8222-222222222221";
const b="22222222-2222-4222-8222-222222222222";
const msg={id:a,sender_id:peer,recipient_id:self};
const mock=(data,error=null)=>({from:table=>{assert.equal(table,"direct_messages");return{select:fields=>{assert.equal(fields,"id,sender_id,recipient_id");return{in:async(column,ids)=>{assert.equal(column,"id");return{data,error};}};}};}});
(async()=>{
 const cases=[
 ["valid",mock([msg]),self,peer,[a],true],
 ["unknown returned id",mock([{...msg,id:b}]),self,peer,[a],false],
 ["uppercase request",mock([msg]),self.toUpperCase(),peer.toUpperCase(),[a.toUpperCase()],true],
 ["wrong row type",mock([{...msg,id:42}]),self,peer,[a],false],
 ["hidden",mock([]),self,peer,[a],false],
 ["query error",mock(null,{message:"blocked"}),self,peer,[a],false],
 ["wrong sender",mock([{...msg,sender_id:other}]),self,peer,[a],false],
 ["wrong recipient",mock([{...msg,recipient_id:other}]),self,peer,[a],false],
 ["duplicate requested",mock([msg]),self,peer,[a,a],false],
 ["invalid id",mock([msg]),self,peer,["bad"],false],
 ["self report",mock([msg]),self,self,[a],false],
 ["duplicate DB results",mock([msg,msg]),self,peer,[a,b],false],
 ["missing DB result",mock([msg]),self,peer,[a,b],false],
 ["reverse direction",mock([{id:a,sender_id:self,recipient_id:peer}]),self,peer,[a],true],
 ["two messages",mock([msg,{id:b,sender_id:self,recipient_id:peer}]),self,peer,[a,b],true],
 ];
 for(const [name,client,u,p,ids,expected] of cases){
  const result=await verifyVisibleMessages(client,u,p,ids);
  assert.equal(result.ok,expected,name);
 }
 console.log("PASS: "+cases.length+" RLS lookup mock cases");
})().catch(error=>{console.error(error);process.exitCode=1;});
