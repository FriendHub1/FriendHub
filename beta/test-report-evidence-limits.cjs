"use strict";
const assert=require("node:assert/strict");
const {verifyVisibleMessages}=require("./report-rls-check.cjs");
const self="44444444-4444-4444-8444-444444444444";
const peer="33333333-3333-4333-8333-333333333333";
const ids=Array.from({length:21},(_,i)=>"22222222-2222-4222-8222-"+String(i+1).padStart(12,"0"));
let queries=0;
const client={from:()=>{queries++;return {select:()=>({in:async(_field,requested)=>({data:requested.map((id,i)=>({id,sender_id:i%2?self:peer,recipient_id:i%2?peer:self})),error:null})})};}};
(async()=>{
 for(const invalid of [[],ids,Array(20).fill(ids[0])]){
  const result=await verifyVisibleMessages(client,self,peer,invalid);
  assert.deepEqual(result,{ok:false,reason:"invalid_input"});
 }
 assert.equal(queries,0,"invalid counts must be rejected before query");
 for(const size of [1,20]){
  const result=await verifyVisibleMessages(client,self,peer,ids.slice(0,size));
  assert.deepEqual(result,{ok:true,reason:null});
 }
 assert.equal(queries,2);
 console.log("PASS: 5 evidence count boundary cases");
})().catch(e=>{console.error(e);process.exitCode=1;});
