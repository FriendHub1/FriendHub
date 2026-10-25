"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const source=fs.readFileSync(require("node:path").join(__dirname,"admin-report-panel-bridge.js"),"utf8");
const reporter="33333333-3333-4333-8333-333333333333",peer="44444444-4444-4444-8444-444444444444";
const report={id:"22222222-2222-4222-8222-222222222222",reporter_id:reporter,reported_user_id:peer,
 reason:"Scam or money requests",details:"Reported",status:"pending",evidence_count:2,
 evidence_message_ids:["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1","aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2"],
 created_at:"2026-10-24T12:00:00Z",source:"conversation_beta"};
function element(tag){
 return {tag,children:[],textContent:"",listeners:{},attributes:{},style:{},className:"",disabled:false,
  append(...items){for(const item of items){item.parent=this;this.children.push(item)}},
  setAttribute(name,value){this.attributes[name]=value},
  removeAttribute(name){delete this.attributes[name]},
  addEventListener(name,fn){this.listeners[name]=fn},
  querySelectorAll(selector){return this.children.filter(x=>selector==="button"?x.tag==="button":
    selector==="[data-xoxo-conversation-beta-report]"?!!x.attributes["data-xoxo-conversation-beta-report"]:
    selector==='[data-xoxo-safety-report-evidence="1"]'?x.attributes["data-xoxo-safety-report-evidence"]==="1":
    selector==="[data-xoxo-safety-evidence-label]"?!!x.attributes["data-xoxo-safety-evidence-label"]:
    selector==="[data-xoxo-safety-report-unlock]"?!!x.attributes["data-xoxo-safety-report-unlock"]:
    selector===".xmm-report-feedback"?x.className==="xmm-report-feedback":false)},
  remove(){this.removed=true;if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this)}};
}
(async()=>{
 const list=element("section");const viewer=element("section");
 const moderation={classList:{contains:()=>true}};
 const calls={legacy:0,queue:0,pin:0,unlock:0,updates:0};
 let betaAvailable=true,admin=true,legacyFails=false,updateFails=false;
 const context={
  window:{confirm:()=>true,loadXoxoDmReports:async()=>{calls.legacy++;if(legacyFails)throw Error("legacy loader failed");list.children=[element("legacy-card")];},
   xoxoDmMakeMessage:(message)=>{const bubble=element("article");bubble.textContent=message.content;return bubble;},
   renderXoxoDmReports:()=>{list.children=[element("legacy-card")];},
   XOXOAdminReportQueueBeta:{loadReportQueue:async(_client,options)=>{calls.queue++;assert.equal(options?.includeLegacy,false,"legacy RPC already ran");
      assert.equal(options?.moderationReason,"Report queue moderation access",
        "forward the existing PIN moderation reason, not a new dialog");
      return betaAvailable?{ok:true,reports:[report]}:{ok:false};},
    updateReportStatus:async(_client,_report,_status,reason)=>{
      assert.equal(reason,"Report queue moderation access",
        "status changes need the same PIN moderation reason");
      calls.updates++;return updateFails?{ok:false}:{ok:true};}}},
  document:{readyState:"complete",createElement:element,getElementById:id=>id==="xmmReportsList"?list:id==="xmmMessages"?viewer:id==="xoxoAdminModeration"?moderation:null},
  supabaseClient:{},
  get xoxoIsAdmin(){return admin;},
  getFriendHubLanguage:()=> "es",
  xoxoModerationPinAuthorize:async()=>{calls.unlock++;return {reason:"Report queue moderation access"};},
  openXoxoDmConversation:c=>{calls.pin++;assert.equal(c.user_1,reporter);assert.equal(c.user_2,peer);}
 };
 vm.runInNewContext(source,context);
 assert.equal(context.window.__xoxoAdminReportBridgeBetaInstalled,true);
 await context.window.loadXoxoDmReports();
 assert.equal(calls.legacy,1);
 assert.equal(calls.queue,0,"MUST NOT fetch report metadata before PIN verification");
 assert.equal(list.querySelectorAll("[data-xoxo-safety-report-unlock]").length,1);
 const unlock=list.querySelectorAll("[data-xoxo-safety-report-unlock]")[0];
 await unlock.listeners.click();
 assert.equal(calls.unlock,1);
 assert.equal(calls.queue,1);
 assert.equal(list.querySelectorAll("[data-xoxo-conversation-beta-report]").length,1);
 assert.equal(list.children.length,2,"existing legacy card must remain alongside BETA report");
 const beforeFirstRender=calls.queue;
 context.window.renderXoxoDmReports();
 assert.equal(list.querySelectorAll("[data-xoxo-conversation-beta-report]").length,0,
   "re-render must remove cached sensitive metadata until server reauthorizes");
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(calls.queue,beforeFirstRender+1,"direct render must recheck PIN server-side");
 assert.equal(list.children.length,2,"successful reauthorization should restore BETA card beside legacy");
 const beforeSecondRender=calls.queue;
 context.window.renderXoxoDmReports();
 assert.equal(list.querySelectorAll("[data-xoxo-conversation-beta-report]").length,0,
   "second render must not immediately expose previously cached reports");
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(calls.queue,beforeSecondRender+1);
 assert.equal(list.children.length,2,"repeated renders must not duplicate BETA reports");
 const card=list.querySelectorAll("[data-xoxo-conversation-beta-report]")[0];
 const actions=card.children.find(x=>x.className==="xmm-report-actions");
 actions.children[0].listeners.click();
 assert.equal(calls.pin,1,"the existing PIN-gated viewer must be reused");
 const selected=context.window.xoxoDmMakeMessage({id:report.evidence_message_ids[0],content:"Synthetic evidence"},
   {user_1:reporter,user_2:peer});
 assert.equal(selected.attributes["data-xoxo-safety-report-evidence"],"1",
   "only selected evidence must be marked in the existing viewer");
 assert.equal(selected.children.length,1,"a visible localized evidence marker is required");
 assert.match(selected.children[0].textContent,/Pruebas seleccionadas/);
 viewer.append(selected);
 const unselected=context.window.xoxoDmMakeMessage({id:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",content:"Unselected"},
   {user_1:reporter,user_2:peer});
 assert.equal(unselected.attributes["data-xoxo-safety-report-evidence"],undefined);
 const otherChat=context.window.xoxoDmMakeMessage({id:report.evidence_message_ids[0]},
   {user_1:reporter,user_2:"cccccccc-cccc-4ccc-8ccc-cccccccccccc"});
 assert.equal(otherChat.attributes["data-xoxo-safety-report-evidence"],undefined,
   "evidence cannot be marked in a different conversation");
 await actions.children[1].listeners.click();
 assert.equal(calls.updates,1);assert.ok(calls.queue>=4);
 assert.equal(list.querySelectorAll("[data-xoxo-conversation-beta-report]").length,1);
 updateFails=true;
 const oldCard=list.querySelectorAll("[data-xoxo-conversation-beta-report]")[0];
 const oldActions=oldCard.children.find(x=>x.className==="xmm-report-actions");
 await oldActions.children[1].listeners.click();
 assert.equal(list.querySelectorAll("[data-xoxo-conversation-beta-report]").length,0,
   "a status update failure must immediately purge sensitive BETA metadata");
 assert.equal(list.querySelectorAll("[data-xoxo-safety-report-unlock]").length,1,
   "after an update failure the existing PIN must be verified again");
 assert.equal(viewer.children.length,1,"the original viewer history must remain mounted");
 assert.equal(selected.attributes["data-xoxo-safety-report-evidence"],undefined,
   "PIN invalidation must remove markers from already mounted original messages");
 assert.equal(selected.children.length,0,
   "PIN invalidation must remove the evidence badge, not its original message");
 const revokedEvidence=context.window.xoxoDmMakeMessage({id:report.evidence_message_ids[0]},
   {user_1:reporter,user_2:peer});
 assert.equal(revokedEvidence.attributes["data-xoxo-safety-report-evidence"],undefined,
   "losing PIN access must also clear selected-evidence highlighting");
 updateFails=false;
 const unlockAfterUpdateError=list.querySelectorAll("[data-xoxo-safety-report-unlock]")[0];
 await unlockAfterUpdateError.listeners.click();
 assert.equal(list.querySelectorAll("[data-xoxo-conversation-beta-report]").length,1);
 betaAvailable=false;
 const beforeExpiry=calls.queue;
 context.window.renderXoxoDmReports();
 assert.equal(list.querySelectorAll("[data-xoxo-conversation-beta-report]").length,0,
   "PIN expiry: do not replay cached reports while auth request is pending");
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(calls.queue,beforeExpiry+1);
 assert.equal(list.querySelectorAll("[data-xoxo-safety-report-unlock]").length,1,
   "PIN expiry must offer verification again");
 await context.window.loadXoxoDmReports();
 assert.equal(list.querySelectorAll("[data-xoxo-conversation-beta-report]").length,0,"failed BETA refresh clears stale cards");
 betaAvailable=true;
 const newUnlock=list.querySelectorAll("[data-xoxo-safety-report-unlock]")[0];
 assert.ok(newUnlock,"unlock remains available after an invalidated PIN");
 await newUnlock.listeners.click();
 assert.equal(list.querySelectorAll("[data-xoxo-conversation-beta-report]").length,1);
 legacyFails=true;
 let loaderThrown=false;
 try { await context.window.loadXoxoDmReports(); }
 catch (e) { loaderThrown=/legacy loader failed/.test(String(e)); }
 assert.equal(loaderThrown,true,"original admin load failure should propagate");
 assert.equal(list.querySelectorAll("[data-xoxo-conversation-beta-report]").length,0,
   "legacy failure must purge prior private BETA metadata");
 assert.equal(list.querySelectorAll("[data-xoxo-safety-report-unlock]").length,1,
   "legacy failure should require PIN verification again");
 legacyFails=false;
 admin=false;
 const beforeNonAdmin=calls.queue;
 await context.window.loadXoxoDmReports();
 assert.equal(calls.queue,beforeNonAdmin,"non-admin reload must not request report metadata");
 console.log("PASS: existing admin bridge requires PIN, keeps legacy cards, reuses audited viewer and clears stale reports");
})().catch(e=>{console.error(e);process.exitCode=1;});
