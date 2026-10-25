"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const source=fs.readFileSync(require("node:path").join(__dirname,"stay-safe-chat-preview-bridge.js"),"utf8");
const self="44444444-4444-4444-8444-444444444444";
const peer="33333333-3333-4333-8333-333333333333";
const foreign="55555555-5555-4555-8555-555555555555";
const msg="22222222-2222-4222-8222-222222222222";
const outsiderMsg="11111111-1111-4111-8111-111111111111";
const report="66666666-6666-4666-8666-666666666666";
const chat={style:{display:"block"},isConnected:true};
let selectedPeer=peer,authUser=self,rows=[],reported=[],messageStore=[];
const client={
 auth:{getUser:async()=>({data:{user:authUser?{id:authUser}:null},error:null})},
 from:table=>{
  assert.equal(table,"direct_messages");
  return {select:fields=>{
    assert.equal(fields,"id,sender_id,recipient_id");
    return {in:async(field,ids)=>{assert.equal(field,"id");return {data:rows.filter(r=>ids.includes(r.id)),error:null};}};
  }};
 },
 rpc:async(name,args)=>{reported.push({name,args});return {data:report,error:null};}
};
const header={
 buttons:[],
 querySelector:()=>null,
 append(e){this.buttons.push(e);},
 insertBefore(e){this.buttons.push(e);}
};
const document={
 readyState:"loading",
 addEventListener:()=>{},
 getElementById:id=>id==="dmChat"?chat:id==="xoxoSafetyConversationReportBeta"?header.buttons.find(b=>b.id===id)||null:null,
 querySelector:s=>s==="#dmChat .dm-chat-header"?header:null,
 createElement:tag=>({tag,style:{},listeners:{},setAttribute(k,v){this[k]=v;},
   addEventListener(k,fn){this.listeners[k]=fn;}})
};
const window={
 __xoxoCurrentDmMessages:[],
 crypto:{randomUUID:()=>report},
 alert:()=>{},
 XOXOSafetyReminderBeta:{show:()=>true},
 XOXOReportFormBeta:{open:()=>true},
 XOXOEvidencePickerBeta:{open:()=>true},
 XOXOSafetyFlowBeta:{create:()=>({showReminder:()=>true,openReport:()=>true})}
};
const context={window,document,currentUser:{id:self},supabaseClient:client,
 get currentDmUserId(){return selectedPeer;},
 getFriendHubLanguage:()=>"es"};
vm.runInNewContext(source,context);
const bridge=window.XOXOSafetyChatPreviewBeta;
assert.ok(bridge);
(async()=>{
 window.__xoxoCurrentDmMessages=[
  {id:msg,sender_id:peer,recipient_id:self,content:"Example evidence"},
  {id:outsiderMsg,sender_id:foreign,recipient_id:self,content:"NEVER SHOW THIS"}
 ];
 rows=[{id:msg,sender_id:peer,recipient_id:self}];
 let ctx=bridge.visibleContext();
 assert.equal(ctx.messages.length,1);
 assert.equal(ctx.messages[0].text,"Example evidence");
 assert.equal(bridge.refresh(),true);
 assert.equal(header.buttons.length,1,"one additional report button, not a new chat viewer");
 assert.equal(bridge.refresh(),true);
 assert.equal(header.buttons.length,1,"no duplicate report buttons");
 const draft={reasonCode:1,details:"Threatening message"};
 const blocked=await bridge.submit(ctx,draft,[msg]);
 assert.equal(blocked.ok,false,"read-only preview cannot pretend to submit");
 assert.equal(blocked.reason,"beta_backend_disabled");
 assert.equal(reported.length,0,"preview must never call the report RPC");
 assert.equal(bridge.reportWritesEnabled(),false);
 selectedPeer=foreign;
 assert.equal(bridge.visibleContext().messages.length,0,
   "foreign conversation cannot retain evidence from the prior chat");
 selectedPeer=peer;
 assert.equal(bridge.openReport(),true);
 chat.style.display="none";
 assert.equal(bridge.visibleContext(),null);
 assert.equal(bridge.openReport(),false);
 assert.equal(reported.length,0,"preview must never write reports");
 console.log("PASS: chat preview is read-only, filters messages by pair and keeps a single report button");
})().catch(e=>{console.error(e);process.exitCode=1});
