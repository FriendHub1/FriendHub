"use strict";
const assert=require("node:assert/strict");
const {createReportRpcWriter}=require("./report-rpc-writer.cjs");
const peer="33333333-3333-4333-8333-333333333333";
const id="22222222-2222-4222-8222-222222222221";
const key="11111111-1111-4111-8111-111111111111";
const payload={otherUserId:peer,reasonCode:0,details:"",messageIds:[id],idempotencyKey:key};
(async()=>{
 let calls=0;
 const client={rpc:async(name,args)=>{calls++;assert.equal(name,"xoxo_submit_conversation_report_beta");assert.equal(args.p_other_user_id,peer);assert.deepEqual(args.p_message_ids,[id]);return {data:key,error:null};}};
 assert.deepEqual(await createReportRpcWriter(client)(payload),{ok:true,reportId:key});
 for(const invalid of [{...payload,messageIds:[]},{...payload,messageIds:[id,id]},{...payload,reasonCode:6},{...payload,idempotencyKey:"bad"}]){
  assert.deepEqual(await createReportRpcWriter(client)(invalid),{ok:false});
 }
 assert.deepEqual(await createReportRpcWriter(client)([]),{ok:false});
 assert.equal(calls,1,"invalid payload must never call RPC");
 assert.deepEqual(await createReportRpcWriter(null)(payload),{ok:false});
 assert.deepEqual(await createReportRpcWriter({rpc:async()=>({data:null,error:{message:"not installed"}})})(payload),{ok:false});
 assert.deepEqual(await createReportRpcWriter({rpc:async()=>{throw Error("offline")}})(payload),{ok:false});
 console.log("PASS: 9 BETA RPC transport cases");
})().catch(e=>{console.error(e);process.exitCode=1;});
