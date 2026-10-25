/* Run: node beta/test-stay-safe-report-flow.cjs
 * Zero network calls, no Supabase credentials, no database writes.
 */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");
const dir=__dirname;
const peer="33333333-3333-4333-8333-333333333333";
const self="44444444-4444-4444-8444-444444444444";
const outsider="55555555-5555-4555-8555-555555555555";
const id1="22222222-2222-4222-8222-222222222221";
const id2="22222222-2222-4222-8222-222222222222";
const context={window:{},console};
vm.createContext(context);
for(const file of ["stay-safe-report-validation.js","stay-safe-report-flow.js"]){
 vm.runInContext(fs.readFileSync(path.join(dir,file),"utf8"),context,{filename:file});
}
const validate=context.window.XOXOReportValidationBeta.validate;
const base={otherUserId:peer,reasonCode:0,details:"",messageIds:[id1]};
assert.equal(validate(base).ok,true);
for(const bad of [
 {...base,reasonCode:7},
 {...base,details:"x".repeat(2001)},
 {...base,messageIds:[]},
 {...base,messageIds:[id1,id1]},
 {...base,messageIds:[outsider]},
 {...base,messageIds:Array(21).fill(id1)}
])assert.equal(validate(bad).ok,false);
let prepared=null;
let selection=[id1];
context.window.XOXOReportFormBeta={open:({onContinue})=>{onContinue({reasonCode:0,details:""});return true;}};
context.window.XOXOEvidencePickerBeta={open:({onContinue})=>{onContinue({messageIds:selection});return true;}};
const start=context.window.XOXOReportFlowBeta.start;
const opts={conversationId:"demo-chat",currentUserId:self,otherUserId:peer,
 messages:[
 {id:id1,senderId:peer,recipientId:self},
 {id:id2,senderId:outsider,recipientId:self}
 ],onPrepared:payload=>{prepared=payload;}};
assert.equal(start(opts),true);
assert.equal(prepared.messageIds[0],id1);
prepared=null;selection=[id2];start(opts);assert.equal(prepared,null,"Reject unrelated message");
prepared=null;selection=[id1];assert.equal(start({...opts,currentUserId:peer}),false,"Reject self-report");
assert.equal(prepared,null);
console.log("PASS: 12 validation and conversation-membership checks");
