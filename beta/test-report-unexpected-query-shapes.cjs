"use strict";
const assert=require("node:assert/strict");
const {verifyVisibleMessages}=require("./report-rls-check.cjs");
const self="44444444-4444-4444-8444-444444444444";
const peer="33333333-3333-4333-8333-333333333333";
const id="22222222-2222-4222-8222-222222222221";
const mock=value=>({from:()=>({select:()=>({in:async()=>value})})});
(async()=>{
 for(const value of [null,undefined,{}, {data:null,error:null},{data:{id},error:null},{data:[],error:null},{data:[{id,sender_id:self,recipient_id:peer}],error:{message:"RLS error"}}]){
  const result=await verifyVisibleMessages(mock(value),self,peer,[id]);
  assert.equal(result.ok,false,"must reject malformed response");
 }
 console.log("PASS: 7 unexpected Supabase response cases");
})().catch(e=>{console.error(e);process.exitCode=1;});
