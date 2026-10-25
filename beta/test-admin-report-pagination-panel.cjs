"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");
const source=fs.readFileSync(path.join(__dirname,"admin-report-panel-bridge.js"),"utf8");

const uuid=n=>"dddddddd-dddd-4ddd-8ddd-"+n.toString(16).padStart(12,"0");
const reporter="11111111-1111-4111-8111-111111111111";
const reported="22222222-2222-4222-8222-222222222222";
const reason="Reviewing report history after validating moderator access";
const row=(n,status="pending")=>({
 id:uuid(n),reporter_id:reporter,reported_user_id:reported,
 reason_code:0,reason:"Scam or money requests",evidence_count:2,
 details:"Synthetic report "+n,status,created_at:new Date(Date.UTC(2026,9,25,11,0,0)-n*60000).toISOString(),
 source:"conversation_beta"
});
const initial=Array.from({length:100},(_,i)=>row(i+1));
const more1=Array.from({length:50},(_,i)=>row(i+101));
const more2=Array.from({length:25},(_,i)=>row(i+151,"resolved"));

function element(tag){
 return {tag,children:[],textContent:"",attributes:{},listeners:{},className:"",
  disabled:false,type:"",parent:null,
  append(...items){for(const child of items){child.parent=this;this.children.push(child)}},
  setAttribute(name,value){this.attributes[name]=value},
  addEventListener(name,callback){this.listeners[name]=callback},
  querySelectorAll(selector){
    return this.children.filter(node=>selector==="button"?node.tag==="button":
      selector==="[data-xoxo-conversation-beta-report]"?node.attributes["data-xoxo-conversation-beta-report"]:
      selector==="[data-xoxo-safety-report-notice]"?node.attributes["data-xoxo-safety-report-notice"]:
      selector==="[data-xoxo-safety-report-unlock]"?node.attributes["data-xoxo-safety-report-unlock"]:
      selector==="[data-xoxo-safety-load-more]"?node.attributes["data-xoxo-safety-load-more"]:
      selector===".xmm-report-feedback"?node.className==="xmm-report-feedback":false);
  },
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this)}
 };
}
function pause(){return new Promise(r=>setImmediate(r))}
(async()=>{
 const list=element("div");
 const moderation={classList:{contains:value=>value==="active"}};
 const calls={pin:0,old:0,page:0,queue:0};
 let resolver=null,nextPage=1,failed=false,authChanged=null;
 const adapter={
   cursorAfter:r=>({pending:r.status==="pending",created_at:r.created_at,id:r.id}),
   loadReportQueue:async(_client,options)=>{
     assert.equal(options.includeLegacy,false);
     assert.equal(options.moderationReason,reason);
     calls.queue++;
     return {ok:true,reports:initial};
   },
   loadMoreReports:async(_client,opts)=>{
     calls.page++;
     assert.equal(opts.moderationReason,reason);
     assert.equal(opts.limit,50);
     assert.ok(opts.cursor?.id);
     if(failed)return {ok:false,reason:"permission_lost"};
     const rows=nextPage++===1?more1:more2;
     if(resolver)return new Promise(resolve=>{resolver=resolve});
     return {ok:true,reports:rows,hasMore:rows===more1,
       nextCursor:rows===more1?adapter.cursorAfter(rows.at(-1)):null};
   }
 };
 const context={
   window:{
     confirm:()=>true,
     loadXoxoDmReports:async()=>{
       calls.old++;list.children=[element("legacy-report")];list.children[0].parent=list;
     },
     renderXoxoDmReports:()=>{list.children=[element("legacy-report")];list.children[0].parent=list},
     XOXOAdminReportQueueBeta:adapter
   },
   document:{readyState:"complete",createElement:element,
     getElementById:id=>id==="xmmReportsList"?list:
       id==="xoxoAdminModeration"?moderation:null},
   supabaseClient:{auth:{
     onAuthStateChange:callback=>{authChanged=callback;return {
       data:{subscription:{unsubscribe(){}}}
     };}
   }},
   xoxoIsAdmin:true,
   getFriendHubLanguage:()=>"es",
   xoxoModerationPinAuthorize:async()=>{calls.pin++;return {reason}}
 };
 vm.runInNewContext(source,context);
 const sel=name=>list.querySelectorAll(name);
 await context.window.loadXoxoDmReports();
 assert.equal(calls.page,0);
 assert.equal(sel("[data-xoxo-safety-load-more]").length,0,
   "No paging actions may render before verifying the PIN");
 await sel("[data-xoxo-safety-report-unlock]")[0].listeners.click();
 assert.equal(sel("[data-xoxo-conversation-beta-report]").length,100);
 assert.equal(sel("[data-xoxo-safety-load-more]").length,1);
 assert.equal(list.children[0].tag,"legacy-report","Legacy report viewer still present");
 assert.equal(sel("[data-xoxo-safety-load-more]")[0].textContent,"Cargar más denuncias");

 // In-flight page loading hides old cached metadata until RPC authorizes anew.
 resolver=()=>{};
 const more=sel("[data-xoxo-safety-load-more]")[0];
 more.listeners.click();
 assert.equal(sel("[data-xoxo-conversation-beta-report]").length,0,
   "Previously cached report metadata must disappear while PIN is rechecked");
 const delayed=resolver;resolver=null;
 delayed({ok:true,reports:more1,hasMore:true,nextCursor:adapter.cursorAfter(more1.at(-1))});
 await pause();await pause();
 assert.equal(sel("[data-xoxo-conversation-beta-report]").length,150);
 assert.equal(sel("[data-xoxo-safety-load-more]").length,1);
 sel("[data-xoxo-safety-load-more]")[0].listeners.click();
 await pause();await pause();
 assert.equal(sel("[data-xoxo-conversation-beta-report]").length,175);
 assert.equal(sel("[data-xoxo-safety-load-more]").length,0,
   "Load more must disappear at the final page");
 assert.equal(new Set(sel("[data-xoxo-conversation-beta-report]").map(x=>x.attributes["data-xoxo-conversation-beta-report"])).size,175);
 assert.equal(list.children[0].tag,"legacy-report");
 assert.equal(calls.pin,1,"Loading more should not display a second PIN dialog");
 assert.equal(calls.page,2);

 // A new legacy render requires a fresh initial server query, not cached replay.
 context.window.renderXoxoDmReports();
 assert.equal(sel("[data-xoxo-conversation-beta-report]").length,0);
 await pause();await pause();
 assert.equal(sel("[data-xoxo-conversation-beta-report]").length,100);
 assert.equal(sel("[data-xoxo-safety-load-more]").length,1);
 failed=true;
 sel("[data-xoxo-safety-load-more]")[0].listeners.click();
 await pause();await pause();
 assert.equal(sel("[data-xoxo-conversation-beta-report]").length,0,
   "Failed page authorization clears ALL private report metadata");
 assert.equal(sel("[data-xoxo-safety-load-more]").length,0);
 assert.equal(sel("[data-xoxo-safety-report-unlock]").length,1,
   "Expired PIN must offer reauthorization, not stale report data");
 assert.equal(list.children[0].tag,"legacy-report");
 assert.equal(calls.pin,1);

 // A completed authorization is NOT reusable after logout. In particular,
 // an old Load more response must never rebuild 100+ report cards.
 failed=false;
 await sel("[data-xoxo-safety-report-unlock]")[0].listeners.click();
 assert.equal(sel("[data-xoxo-conversation-beta-report]").length,100);
 resolver=()=>{};
 sel("[data-xoxo-safety-load-more]")[0].listeners.click();
 assert.equal(sel("[data-xoxo-conversation-beta-report]").length,0);
 const delayedAfterLogout=resolver;
 assert.equal(typeof delayedAfterLogout,"function");
 resolver=null;
 authChanged("SIGNED_OUT",null);
 delayedAfterLogout({ok:true,reports:more1,hasMore:true,
    nextCursor:adapter.cursorAfter(more1.at(-1))});
 await pause();await pause();
 assert.equal(sel("[data-xoxo-conversation-beta-report]").length,0,
   "Late continuation response after logout must never repaint 150 private cards");
 assert.equal(sel("[data-xoxo-safety-load-more]").length,0);
 assert.equal(sel("[data-xoxo-safety-report-unlock]").length,1);
 assert.equal(list.children[0].tag,"legacy-report");

 const translations=context.window.XOXOActiveAdminSafetyCopyBeta;
 for(const language of ["en","es","pt-BR","fr","pl","de","cs","no","sv","it"]){
   assert.ok(translations[language].more && translations[language].loadingMore,
     "Missing safe pagination translation for "+language);
 }
 console.log("PASS: existing PIN panel pages 100→150→175, no duplicates, safe loading/failure, legacy cards, 10 languages");
})().catch(e=>{console.error(e);process.exitCode=1});
