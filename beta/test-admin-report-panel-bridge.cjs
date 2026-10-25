"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const source=fs.readFileSync(require("node:path").join(__dirname,"admin-report-panel-bridge.js"),"utf8");
const reporter="33333333-3333-4333-8333-333333333333",peer="44444444-4444-4444-8444-444444444444";
const report={id:"22222222-2222-4222-8222-222222222222",reporter_id:reporter,reported_user_id:peer,
 reason:"Scam or money requests",details:"Reported",status:"pending",evidence_count:2,
 created_at:"2026-10-24T12:00:00Z",source:"conversation_beta"};
function element(tag){
  return {tag,children:[],textContent:"",listeners:{},attributes:{},className:"",disabled:false,
   append(...items){this.children.push(...items)},
   setAttribute(name,value){this.attributes[name]=value},
   addEventListener(name,fn){this.listeners[name]=fn},
   querySelectorAll(){return this.children.filter(x=>x.tag==="button")},
   remove(){this.removed=true}};
}
(async()=>{
 const list=element("section");const moderation={classList:{contains:()=>true}};
 const calls={legacy:0,queue:0,pin:0,updates:0};
 const context={
  window:{confirm:()=>true,loadXoxoDmReports:async()=>{calls.legacy++;list.children=[element("legacy-card")];},
   XOXOAdminReportQueueBeta:{loadReportQueue:async()=>{calls.queue++;return {ok:true,reports:[report]};},
    updateReportStatus:async()=>{calls.updates++;return {ok:true};}}},
  document:{readyState:"complete",createElement:element,getElementById:id=>id==="xmmReportsList"?list:id==="xoxoAdminModeration"?moderation:null},
  xoxoIsAdmin:true,supabaseClient:{},
  openXoxoDmConversation:c=>{calls.pin++;assert.equal(c.user_1,reporter);assert.equal(c.user_2,peer);}
 };
 vm.runInNewContext(source,context);
 assert.equal(context.window.__xoxoAdminReportBridgeBetaInstalled,true);
 await context.window.loadXoxoDmReports();
 assert.equal(calls.legacy,1);assert.equal(calls.queue,1);
 assert.equal(list.children.length,2,"existing legacy card must remain alongside BETA report");
 const card=list.children[1];assert.equal(card.attributes["data-xoxo-conversation-beta-report"],report.id);
 const actions=card.children.find(x=>x.className==="xmm-report-actions");
 const view=actions.children[0];view.listeners.click();assert.equal(calls.pin,1,"existing PIN-gated viewer must be reused");
 await actions.children[1].listeners.click();assert.equal(calls.updates,1);assert.equal(calls.legacy,2);
 assert.equal(list.children.length,2,"reloading must not duplicate report cards");
 context.xoxoIsAdmin=false;
 await context.window.loadXoxoDmReports();
 assert.equal(calls.queue,2,"non-admin reload must not request BETA report metadata");
 console.log("PASS: admin bridge preserves existing reports, reuses viewer, updates status and blocks non-admin queue reads");
})().catch(e=>{console.error(e);process.exitCode=1;});
