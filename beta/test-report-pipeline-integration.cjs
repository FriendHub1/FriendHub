"use strict";
const assert=require("node:assert/strict");
const {submitPreparedConversationReport}=require("./report-submission-orchestrator.cjs");
const {createReportRpcWriter}=require("./report-rpc-writer.cjs");
const self="44444444-4444-4444-8444-444444444444";
const peer="33333333-3333-4333-8333-333333333333";
const outsider="55555555-5555-4555-8555-555555555555";
const message="22222222-2222-4222-8222-222222222221";
const key="11111111-1111-4111-8111-111111111111";
const input={otherUserId:peer,reasonCode:2,details:"Please review",messageIds:[message],idempotencyKey:key};
function mock({user=self,rows=[{id:message,sender_id:peer,recipient_id:self}],rpcData=key,rpcError=null}={}){
 const events=[];
 const client={
  auth:{getUser:async()=>{events.push("auth");return {data:{user:user?{id:user}:null},error:null};}},
  from:table=>{assert.equal(table,"direct_messages");return {select:fields=>{assert.equal(fields,"id,sender_id,recipient_id");return {in:async(field,ids)=>{events.push("evidence");assert.equal(field,"id");assert.deepEqual(ids,[message]);return {data:rows,error:null};}};}};},
  rpc:async(name,args)=>{events.push("rpc");assert.equal(name,"xoxo_submit_conversation_report_beta");assert.equal(args.p_other_user_id,peer);assert.equal(args.p_reason_code,2);assert.deepEqual(args.p_message_ids,[message]);assert.equal(args.p_idempotency_key,key);return {data:rpcData,error:rpcError};}
 };
 return {client,events};
}
(async()=>{
 const good=mock();
 assert.deepEqual(await submitPreparedConversationReport(good.client,input,createReportRpcWriter(good.client)),{ok:true,reportId:key});
 assert.deepEqual(good.events,["auth","evidence","rpc"],"RPC must run only after authentication and evidence verification");
 const unauth=mock({user:null});
 assert.equal((await submitPreparedConversationReport(unauth.client,input,createReportRpcWriter(unauth.client))).ok,false);
 assert.deepEqual(unauth.events,["auth"]);
 const hidden=mock({rows:[]});
 assert.equal((await submitPreparedConversationReport(hidden.client,input,createReportRpcWriter(hidden.client))).ok,false);
 assert.deepEqual(hidden.events,["auth","evidence"]);
 const cross=mock({rows:[{id:message,sender_id:outsider,recipient_id:self}]});
 assert.equal((await submitPreparedConversationReport(cross.client,input,createReportRpcWriter(cross.client))).ok,false);
 assert.deepEqual(cross.events,["auth","evidence"]);
 const failure=mock({rpcError:{message:"function not installed"},rpcData:null});
 assert.deepEqual(await submitPreparedConversationReport(failure.client,input,createReportRpcWriter(failure.client)),{ok:false,reason:"submission_failed"});
 assert.deepEqual(failure.events,["auth","evidence","rpc"]);
 console.log("PASS: 5 complete BETA report pipeline mock cases");
})().catch(e=>{console.error(e);process.exitCode=1;});
