"use strict";
const assert=require("node:assert/strict");
const {submitConversationReportBeta}=require("./submit-conversation-report-beta.cjs");
const self="44444444-4444-4444-8444-444444444444";
const peer="33333333-3333-4333-8333-333333333333";
const message="22222222-2222-4222-8222-222222222221";
const reportId="11111111-1111-4111-8111-111111111111";
const input={otherUserId:peer,reasonCode:1,details:"Report",messageIds:[message],idempotencyKey:reportId};
(async()=>{
 let rpcCalls=0;
 const client={
  auth:{getUser:async()=>({data:{user:{id:self}},error:null})},
  from:()=>({select:()=>({in:async()=>({data:[{id:message,sender_id:self,recipient_id:peer}],error:null})})}),
  rpc:async()=>{rpcCalls++;return {data:reportId,error:null};}
 };
 assert.deepEqual(await submitConversationReportBeta(client,input),{ok:true,reportId});
 assert.equal(rpcCalls,1);
 assert.deepEqual(await submitConversationReportBeta(client,{...input,messageIds:[]}),{ok:false,reason:"invalid_input"});
 assert.equal(rpcCalls,1);
 assert.deepEqual(await submitConversationReportBeta({...client,rpc:null},input),{ok:false,reason:"invalid_client"});
 assert.deepEqual(await submitConversationReportBeta({...client,auth:{getUser:async()=>({data:{user:null},error:null})}},input),{ok:false,reason:"authentication_failed"});
 assert.equal(rpcCalls,1);
 console.log("PASS: 4 BETA entry point scenarios");
})().catch(e=>{console.error(e);process.exitCode=1;});
