"use strict";
const assert = require("node:assert/strict");
const {verifyVisibleMessages} = require("./report-rls-check.cjs");
const self="44444444-4444-4444-8444-444444444444";
const peer="33333333-3333-4333-8333-333333333333";
const id="22222222-2222-4222-8222-222222222221";
const fake=value=>({toString:()=>value});
let queries=0;
const client={from:()=>{queries++;return {select:()=>({in:async()=>({data:[{id,sender_id:self,recipient_id:peer}],error:null})})};}};
(async()=>{
 for(const args of [[fake(self),peer,[id]],[self,fake(peer),[id]],[self,peer,[fake(id)]],[self,peer,[null]],[self,peer,[42]]]){
  const result=await verifyVisibleMessages(client,...args);
  assert.deepEqual(result,{ok:false,reason:"invalid_input"});
 }
 assert.equal(queries,0,"invalid input must not query Supabase");
 const result=await verifyVisibleMessages(client,self,peer,[id]);
 assert.equal(result.ok,true);
 assert.equal(queries,1);
 console.log("PASS: 6 strict UUID type cases");
})().catch(e=>{console.error(e);process.exitCode=1;});
