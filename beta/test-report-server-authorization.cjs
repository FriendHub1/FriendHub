/* Run locally: node beta/test-report-server-authorization.cjs */
"use strict";
const assert=require("node:assert/strict");
const {authorizeEvidence:check}=require("./report-server-authorization.cjs");
const self="44444444-4444-4444-8444-444444444444";
const peer="33333333-3333-4333-8333-333333333333";
const stranger="55555555-5555-4555-8555-555555555555";
const msg="22222222-2222-4222-8222-222222222221";
const second="22222222-2222-4222-8222-222222222222";
const base={authenticatedUserId:self,otherUserId:peer,messageIds:[msg],messages:[{id:msg,sender_id:peer,recipient_id:self}]};
const cases=[
 [base,true],
 [{...base,authenticatedUserId:peer},false],
 [{...base,authenticatedUserId:"bad"},false],
 [{...base,messageIds:[]},false],
 [{...base,messageIds:[msg,msg]},false],
 [{...base,messageIds:[msg,second]},false],
 [{...base,messages:[{id:msg,sender_id:stranger,recipient_id:self}]},false],
 [{...base,messages:[{id:msg,sender_id:peer,recipient_id:stranger}]},false],
 [{...base,messages:[]},false],
 [{...base,messages:[base.messages[0],base.messages[0]]},false],
 [{...base,messages:[{id:msg,sender_id:self,recipient_id:peer}]},true],
 [{...base,messageIds:[msg,second],messages:[base.messages[0],{id:second,sender_id:self,recipient_id:peer}]},true],
];
for(let i=0;i<cases.length;i++){
 const [input,expected]=cases[i];
 assert.equal(check(input).ok,expected,"case "+(i+1));
}
console.log("PASS: "+cases.length+" server authorization predicate cases");
