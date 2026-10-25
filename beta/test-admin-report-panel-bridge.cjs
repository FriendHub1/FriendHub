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
   append(...items){for(const item of items){item.parent=this;this.children.push(item)}},
   setAttribute(name,value){this.attributes[name]=value},
   addEventListener(name,fn){this.listeners[name]=fn},
   querySelectorAll(selector){return this.children.filter(x=>selector==="button"?x.tag==="button":selector==="[data-xoxo-conversation-beta-report]"?!!x.attributes["data-xoxo-conversation-beta-report"]:selector===".xmm-report-feedback"?x.className==="xmm-report-feedback":false)},
   remove(){this.removed=true;if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this)}};
}
(async()=>{
 const list=element("section");const moderation={classList:{contains:()=>true}};
 const calls={legacy:0,queue:0,pin:0,updates:0};
 let betaAvailable=true;
 const context={
  window:{confirm:()=>true,loadXoxoDmReports:async()=>{calls.legacy++;list.children=[element("legacy-card")];},
   renderXoxoDmReports:()=>{list.children=[element("legacy-card")];},
   XOXOAdminReportQueueBeta:{loadReportQueue:async(_client,options)=>{calls.queue++;assert.equal(options?.includeLegacy,false,"legacy RPC already ran");return betaAvailable?{ok:true,reports:[report]}:{ok:false};},
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
 context.window.renderXoxoDmReports();
 assert.equal(list.children.length,2,"dashboard re-render must preserve BETA card");
 context.window.renderXoxoDmReports();
 assert.equal(list.children.length,2,"repeated renders must never duplicate BETA reports");
 const card=list.children[1];assert.equal(card.attributes["data-xoxo-conversation-beta-report"],report.id);
 const actions=card.children.find(x=>x.className==="xmm-report-actions");
 const view=actions.children[0];view.listeners.click();assert.equal(calls.pin,1,"existing PIN-gated viewer must be reused");
 await actions.children[1].listeners.click();assert.equal(calls.updates,1);assert.equal(calls.legacy,2);
 assert.equal(list.children.length,2,"reloading must not duplicate report cards");
 betaAvailable=false;
 await context.window.loadXoxoDmReports();
 context.window.renderXoxoDmReports();
 assert.equal(list.children.length,1,"failed BETA refresh must clear cached BETA reports");
 betaAvailable=true;
 context.xoxoIsAdmin=false;
 await context.window.loadXoxoDmReports();
 assert.equal(calls.queue,3,"non-admin reload must not request BETA report metadata");
 console.log("PASS: admin bridge preserves legacy reports, survives rerenders, clears stale cache on errors and restricts non-admin access");
})().catch(e=>{console.error(e);process.exitCode=1;});
