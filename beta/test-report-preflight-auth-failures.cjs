"use strict";
const assert=require("node:assert/strict");
const {authenticatedReportPreflight}=require("./report-authenticated-preflight.cjs");
const self="44444444-4444-4444-8444-444444444444";
const peer="33333333-3333-4333-8333-333333333333";
const id="22222222-2222-4222-8222-222222222221";
const input={otherUserId:peer,messageIds:[id]};
(async()=>{
 let queried=false;
 let r=await authenticatedReportPreflight({auth:{getUser:async()=>{throw Error("network");}},from:()=>{queried=true;}},input);
 assert.equal(r.reason,"authentication_failed");
 assert.equal(queried,false,"No DB query after auth failure");
 r=await authenticatedReportPreflight({auth:{getUser:async()=>({data:{user:{id:self}},error:null})},from:()=>({select:()=>({in:async()=>({data:[],error:null})})})},input);
 assert.equal(r.reason,"not_visible");
 r=await authenticatedReportPreflight({auth:{getUser:async()=>({data:{user:{id:self}},error:null})},from:()=>({select:()=>({in:async()=>({data:[{id,sender_id:self,recipient_id:peer}],error:null})})})},input);
 assert.equal(r.ok,true);
 console.log("PASS: 3 authenticated preflight regression cases");
})().catch(e=>{console.error(e);process.exitCode=1;});
