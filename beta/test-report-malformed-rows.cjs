"use strict";
const assert=require("node:assert/strict");
const {verifyVisibleMessages}=require("./report-rls-check.cjs");
const user="44444444-4444-4444-8444-444444444444";
const peer="33333333-3333-4333-8333-333333333333";
const id="22222222-2222-4222-8222-222222222221";
const base={id,sender_id:user,recipient_id:peer};
const mock=row=>({from:()=>({select:()=>({in:async()=>({data:[row],error:null})})})});
(async()=>{
 for(const row of [null,{}, {...base,id:null},{...base,sender_id:null},{...base,recipient_id:"invalid"}]){
  const result=await verifyVisibleMessages(mock(row),user,peer,[id]);
  assert.deepEqual(result,{ok:false,reason:"invalid_result"});
 }
 for(const row of [{...base,id:{toString:()=>id}},{...base,sender_id:{toString:()=>user}},{...base,recipient_id:{toString:()=>peer}}]){
  assert.deepEqual(await verifyVisibleMessages(mock(row),user,peer,[id]),{ok:false,reason:"invalid_result"});
 }
 assert.equal((await verifyVisibleMessages(mock(base),user,peer,[id])).ok,true);
 console.log("PASS: 9 malformed-row regression cases");
})().catch(e=>{console.error(e);process.exitCode=1;});
