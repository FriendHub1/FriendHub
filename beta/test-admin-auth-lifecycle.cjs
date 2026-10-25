"use strict";
/* BETA-only moderator-session lifecycle security regression, no network. */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");
const src=fs.readFileSync(path.join(__dirname,"admin-report-panel-bridge.js"),"utf8");
const adminA="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const adminB="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const reason="Investigating safety reports with audited moderator access";
const uuid=n=>"dddddddd-dddd-4ddd-8ddd-"+n.toString(16).padStart(12,"0");
const report={id:uuid(1),reporter_id:uuid(2),reported_user_id:uuid(3),
 reason_code:1,details:"Fictional safety report",evidence_count:2,
 source:"conversation_beta",created_at:"2026-10-25T14:00:00Z",status:"pending"};

function element(tag){
 return {
  tag,children:[],textContent:"",attributes:{},listeners:{},className:"",
  disabled:false,parent:null,
  append(...items){for(const item of items){item.parent=this;this.children.push(item)}},
  setAttribute(key,value){this.attributes[key]=value},
  addEventListener(key,fn){this.listeners[key]=fn},
  querySelectorAll(selector){
   return this.children.filter(el=>selector==="button"?el.tag==="button":
    selector==="[data-xoxo-conversation-beta-report]"?el.attributes["data-xoxo-conversation-beta-report"]:
    selector==="[data-xoxo-safety-report-unlock]"?el.attributes["data-xoxo-safety-report-unlock"]:
    selector==="[data-xoxo-safety-report-notice]"?el.attributes["data-xoxo-safety-report-notice"]:
    selector==="[data-xoxo-safety-load-more]"?el.attributes["data-xoxo-safety-load-more"]:
    selector===".xmm-report-feedback"?el.className==="xmm-report-feedback":false);
  },
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this)}
 };
}
function tick(){return new Promise(done=>setImmediate(done))}
(async()=>{
 const list=element("div");
 let active=true,admin=true;
 const moderation={classList:{contains:token=>token==="active"&&active}};
 const counts={pin:0,queue:0,legacy:0,viewer:0,statusUpdates:0};
 let authChange,observer,fetchDeferred=false,resolveFetch,visibilityHandler;
 let statusDeferred=false,resolveStatus;
 let pinDeferred=false,resolvePin,rejectPin;
 const auth={onAuthStateChange:fn=>{authChange=fn;return {
   data:{subscription:{unsubscribe(){}}}
 }}};
 class Observer{
  constructor(callback){this.callback=callback;observer=this}
  observe(target,opts){
   assert.equal(target,moderation);
   assert.equal(opts.attributeFilter[0],"class");
  }
  trigger(){this.callback([{type:"attributes",attributeName:"class"}])}
 }
 const context={
   window:{
    confirm:()=>true,
    addEventListener:(event,fn)=>{if(event==="pagehide")visibilityHandler=fn},
    loadXoxoDmReports:async()=>{
      counts.legacy++;list.children=[element("legacy-report")];list.children[0].parent=list;
    },
    renderXoxoDmReports:()=>{
      list.children=[element("legacy-report")];list.children[0].parent=list;
    },
    XOXOAdminReportQueueBeta:{
      loadReportQueue:async()=>{
        counts.queue++;
        if(fetchDeferred)return new Promise(resolve=>{resolveFetch=resolve});
        return {ok:true,reports:[report]};
      },
      updateReportStatus:async()=>{
        counts.statusUpdates++;
        if(statusDeferred)return new Promise(resolve=>{resolveStatus=resolve});
        return {ok:true};
      },
      cursorAfter:()=>null
    }
   },
   document:{
     readyState:"complete",createElement:element,
     getElementById:id=>id==="xoxoAdminModeration"?moderation:
       id==="xmmReportsList"?list:null
   },
   MutationObserver:Observer,
   supabaseClient:{auth},
   get xoxoIsAdmin(){return admin;},
   getFriendHubLanguage:()=>"es",
   xoxoModerationPinAuthorize:async()=>{
     counts.pin++;
     if(pinDeferred)return new Promise((resolve,reject)=>{
       resolvePin=resolve;rejectPin=reject;
     });
     return {reason};
   },
   openXoxoDmConversation:()=>{counts.viewer++}
 };
 vm.runInNewContext(src,context);
 assert.equal(typeof authChange,"function","install must listen to Supabase Auth");
 assert.equal(typeof visibilityHandler,"function","navigation must purge metadata");
 assert.ok(observer,"moderator panel class changes must be monitored");

 const sel=key=>list.querySelectorAll(key);
 const cards=()=>sel("[data-xoxo-conversation-beta-report]").length;
 const unlock=()=>sel("[data-xoxo-safety-report-unlock]")[0];
 const authorize=async()=>{await unlock().listeners.click();assert.equal(cards(),1)};
 const login=user=>authChange("SIGNED_IN",{user:{id:user}});
 authChange("INITIAL_SESSION",{user:{id:adminA}});
 await context.window.loadXoxoDmReports();
 assert.equal(cards(),0);
 await authorize();
 assert.equal(counts.pin,1);
 assert.equal(list.children[0].tag,"legacy-report");

 // Changing to a different account must erase cards immediately.
 login(adminB);
 assert.equal(cards(),0,"account switch leaked previous admin's safety queue");
 assert.ok(unlock(),"new account requires a fresh PIN authorization");
 assert.equal(list.children[0].tag,"legacy-report","legacy cards remain untouched");
 await authorize();
 assert.equal(counts.pin,2);

 // Hide moderator section: private snapshots must not linger in the DOM.
 active=false;
 observer.trigger();
 assert.equal(cards(),0,"leaving moderation must remove BETA cards");
 active=true;
 await context.window.loadXoxoDmReports();
 assert.equal(cards(),0,"returning to moderation cannot replay BETA metadata");
 await authorize();

 // Re-fetch and capture a pending server response, then sign out before it
 // completes. Late data MUST NOT be repainted or leave an unlocked session.
 fetchDeferred=true;
 context.window.renderXoxoDmReports();
 await tick();
 assert.equal(cards(),0);
 assert.equal(typeof resolveFetch,"function");
 authChange("SIGNED_OUT",null);
 assert.equal(cards(),0,"logout while request pending leaked report cards");
 fetchDeferred=false;
 const delayed=resolveFetch;
 resolveFetch=null;
 delayed({ok:true,reports:[report]});
 await tick();await tick();
 assert.equal(cards(),0,"stale post-logout HTTP response repainted private cards");
 assert.ok(unlock(),"signed-out user must reauthorize");

 // The OS/browser page-hide event also removes previously authorized rows.
 login(adminA);
 await authorize();
 assert.equal(cards(),1);
 visibilityHandler();
 assert.equal(cards(),0,"navigation must erase private report metadata");
 // The OS pagehide event erases sensitive data, but the unlock control can
 // be rebuilt by a fresh moderation load if the browser restores the page.
 await context.window.loadXoxoDmReports();
 assert.ok(unlock(),"restored moderation view requires a fresh PIN");

 // SIGNED_IN for the SAME account is also a session boundary: do not keep
 // a previously verified PIN across a new login.
 await authorize();
 login(adminA);
 assert.equal(cards(),0,"same-user new login should invalidate old PIN grants");
 assert.ok(unlock());

 // An in-flight STATUS WRITE may succeed on the server before logout, but
 // its old UI callback must NOT reopen the legacy admin queue afterwards.
 await authorize();
 const card=sel("[data-xoxo-conversation-beta-report]")[0];
 const actions=card.children.find(node=>node.className==="xmm-report-actions");
 const beforeStatusReload=counts.legacy;
 statusDeferred=true;
 const inFlight=actions.children[1].listeners.click();
 await tick();
 assert.equal(counts.statusUpdates,1);
 assert.equal(typeof resolveStatus,"function");
 authChange("SIGNED_OUT",null);
 assert.equal(cards(),0);
 const finishStatus=resolveStatus;
 resolveStatus=null;
 finishStatus({ok:true});
 await inFlight;
 await tick();
 assert.equal(counts.legacy,beforeStatusReload,
   "Late status-write success from old login must not reload admin reports");
 assert.equal(cards(),0);
 assert.ok(unlock());
 actions.children[0].listeners.click();
 assert.equal(counts.viewer,0,
   "Detached conversation button from previous PIN session must be inert");
 assert.equal(counts.queue>=4,true);

 // An old PIN dialog may resolve after account switching. Its successful
 // result belongs to the former user and MUST NOT unlock the new account.
 login(adminA);
 pinDeferred=true;
 const firstPin=unlock().listeners.click();
 await tick();
 assert.equal(typeof resolvePin,"function");
 const beforeObsoletePin=counts.queue;
 login(adminB);
 resolvePin({reason});
 await firstPin;await tick();
 assert.equal(cards(),0,"PIN success from previous account exposed report cards");
 assert.equal(counts.queue,beforeObsoletePin,
   "Obsolete PIN success must not start a report RPC for the new account");
 assert.ok(unlock(),"New account should have its own PIN prompt");

 // Even an obsolete PIN rejection must not invalidate a NEW authorized
 // session or remove that person's currently visible report cards.
 pinDeferred=true;
 login(adminA);
 const oldPin=unlock().listeners.click();
 await tick();
 const rejectOutdated=rejectPin;
 assert.equal(typeof rejectOutdated,"function");
 login(adminB);
 pinDeferred=false;
 await authorize();
 assert.equal(cards(),1);
 const beforeRejectedPin=counts.queue;
 rejectOutdated(new Error("Previous account PIN rejected"));
 await oldPin;await tick();
 assert.equal(cards(),1,"Old PIN error cleared newer account's authorized reports");
 assert.equal(counts.queue,beforeRejectedPin,
   "Old PIN error must not trigger new account report queries");
 console.log("PASS: account switching, delayed PIN success/failure, logout during report/page/status RPCs, tab exit and navigation purge private metadata");
})().catch(error=>{console.error(error);process.exitCode=1});
