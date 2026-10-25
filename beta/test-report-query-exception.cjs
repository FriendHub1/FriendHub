"use strict";
const assert=require("node:assert/strict");
const {authenticatedReportPreflight}=require("./report-authenticated-preflight.cjs");
const self="44444444-4444-4444-8444-444444444444";
const peer="33333333-3333-4333-8333-333333333333";
const id="22222222-2222-4222-8222-222222222221";
const auth={getUser:async()=>({data:{user:{id:self}},error:null})};
(async()=>{
 for(const mode of ["throw","reject"]){
  const client={auth,from:()=>{
   if(mode==="throw") throw Error("network unavailable");
   return {select:()=>({in:async()=>{throw Error("request rejected");}})};
  }};
  const result=await authenticatedReportPreflight(client,{otherUserId:peer,messageIds:[id]});
  assert.deepEqual(result,{ok:false,reason:"query_failed"},mode);
 }
 console.log("PASS: 2 thrown/rejected query scenarios");
})().catch(e=>{console.error(e);process.exitCode=1;});
