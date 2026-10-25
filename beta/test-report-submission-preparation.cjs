"use strict";
const assert=require("node:assert/strict");
const {prepareConversationReport}=require("./report-submission-preparation.cjs");
const self="44444444-4444-4444-8444-444444444444";
const peer="33333333-3333-4333-8333-333333333333";
const id="22222222-2222-4222-8222-222222222221";
const request={otherUserId:peer,reasonCode:1,details:"Please review",messageIds:[id],idempotencyKey:"11111111-1111-4111-8111-111111111111"};
let queries=0;
const client={auth:{getUser:async()=>({data:{user:{id:self}},error:null})},from:()=>{queries++;return{select:()=>({in:async()=>({data:[{id,sender_id:self,recipient_id:peer}],error:null})})};}};
(async()=>{
 for(const patch of [{reasonCode:7},{details:42},{details:"x".repeat(2001)},{messageIds:[]},{messageIds:[id,id]},{idempotencyKey:"bad"},{otherUserId:"bad"}]){
  const result=await prepareConversationReport(client,{...request,...patch});
  assert.deepEqual(result,{ok:false,reason:"invalid_input"});
 }
 assert.equal(queries,0,"invalid payloads must not query database");
 const result=await prepareConversationReport(client,request);
 assert.equal(result.ok,true);
 assert.deepEqual(result.report.messageIds,[id]);
 assert.equal(queries,1);
 console.log("PASS: 8 report preparation cases");
})().catch(e=>{console.error(e);process.exitCode=1;});
