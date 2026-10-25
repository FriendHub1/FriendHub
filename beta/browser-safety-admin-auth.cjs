"use strict";
/* BETA-only real-browser moderation privacy checks. Synthetic rows, no site,
 * Supabase connection, cookies, production users or production message text.
 */
const assert=require("node:assert/strict");
const path=require("node:path");
const {chromium,webkit}=require("playwright");

const sample={
  id:"dddddddd-dddd-4ddd-8ddd-000000000001",
  reporter_id:"11111111-1111-4111-8111-111111111111",
  reported_user_id:"22222222-2222-4222-8222-222222222222",
  reason_code:1,reason:"Threats or blackmail",
  details:"Synthetic browser-only report",
  evidence_count:2,status:"pending",
  created_at:"2026-10-25T15:00:00Z",source:"conversation_beta"
};
const reason="Reviewing synthetic safety reports with audited admin PIN";

async function exercise(browser,engine){
 const context=await browser.newContext({
   viewport:{width:390,height:844},
   isMobile:engine==="webkit",hasTouch:engine==="webkit"
 });
 const page=await context.newPage();
 const errors=[];
 page.on("pageerror",err=>errors.push(err.message));
 try{
  await page.setContent(
    '<main id="xoxoAdminModeration" class="active">'+
    '<section id="xmmReportsList"></section></main>'
  );
  await page.evaluate(({sample,reason})=>{
   window.xoxoIsAdmin=true;
   window.getFriendHubLanguage=()=> "es";
   window.confirm=()=>true;
   window.__authEvents=null;
   window.__holdQueue=false;
   window.__holdStatus=false;
   window.__queueResolve=null;
   window.__statusResolve=null;
   window.__holdPin=false;
   window.__pinResolve=null;
   window.__loadCount=0;
   window.__statusCount=0;
   window.__viewerCount=0;
   window.supabaseClient={
    auth:{onAuthStateChange:fn=>{
      window.__authEvents=fn;
      return {data:{subscription:{unsubscribe(){}}}};
    }}
   };
   window.xoxoModerationPinAuthorize=async()=>{
     if(window.__holdPin)
       return new Promise(resolve=>{window.__pinResolve=resolve});
     return {reason};
   };
   window.openXoxoDmConversation=()=>{window.__viewerCount++};
   window.xoxoDmAdminName=(id)=>id.slice(0,8);
   window.XOXOAdminReportQueueBeta={
     loadReportQueue:async()=>{
       if(window.__holdQueue)
         return new Promise(resolve=>{window.__queueResolve=resolve});
       return {ok:true,reports:[sample]};
     },
     updateReportStatus:async()=>{
       window.__statusCount++;
       if(window.__holdStatus)
         return new Promise(resolve=>{window.__statusResolve=resolve});
       return {ok:true};
     },
     cursorAfter:()=>null
   };
   window.loadXoxoDmReports=async()=>{
     window.__loadCount++;
     const list=document.getElementById("xmmReportsList");
     const legacy=document.createElement("div");
     legacy.id="preserved-legacy-moderation";
     legacy.textContent="Original legacy moderation remains";
     list.replaceChildren(legacy);
   };
   window.renderXoxoDmReports=()=>{
     const list=document.getElementById("xmmReportsList");
     const legacy=document.createElement("div");
     legacy.id="preserved-legacy-moderation";
     list.replaceChildren(legacy);
   };
  },{sample,reason});
  await page.addScriptTag({path:path.join(__dirname,"admin-report-panel-bridge.js")});
  assert.equal(await page.evaluate(()=>typeof window.__authEvents),"function");
  await page.evaluate(()=>window.loadXoxoDmReports());
  assert.equal(await page.locator("[data-xoxo-conversation-beta-report]").count(),0,
    engine+" private cards opened without PIN");
  assert.equal(await page.locator("#preserved-legacy-moderation").count(),1);
  await page.locator("[data-xoxo-safety-report-unlock]").click();
  await page.locator("[data-xoxo-conversation-beta-report]").waitFor();
  assert.equal(await page.locator("#preserved-legacy-moderation").count(),1);

  // In both native browser engines, a throttled background timer must not
  // leave report metadata readable when the tab regains focus after expiry.
  await page.evaluate(()=>{
    const realNow=Date.now;
    try{
      Date.now=()=>realNow()+14*60*1000+1;
      window.dispatchEvent(new Event("focus"));
    }finally{Date.now=realNow}
  });
  assert.equal(await page.locator("[data-xoxo-conversation-beta-report]").count(),0,
    engine+" kept reports visible after PIN expiry on focus");
  assert.equal(await page.locator("#preserved-legacy-moderation").count(),1,
    engine+" removed the existing moderation viewer on PIN expiry");
  await page.locator("[data-xoxo-safety-report-unlock]").click();
  await page.locator("[data-xoxo-conversation-beta-report]").waitFor();

  // Native MutationObserver must remove private data when leaving Moderation.
  await page.evaluate(()=>document.getElementById("xoxoAdminModeration").classList.remove("active"));
  await page.waitForFunction(()=>!document.querySelector("[data-xoxo-conversation-beta-report]"));
  await page.evaluate(async()=>{
   document.getElementById("xoxoAdminModeration").classList.add("active");
   await window.loadXoxoDmReports();
  });
  assert.equal(await page.locator("[data-xoxo-conversation-beta-report]").count(),0,
    engine+" replayed private cards on tab return");
  await page.locator("[data-xoxo-safety-report-unlock]").click();
  await page.locator("[data-xoxo-conversation-beta-report]").waitFor();

  // A late QUEUE read must not repaint after the login changes.
  await page.evaluate(()=>{
   window.__holdQueue=true;
   window.renderXoxoDmReports();
  });
  await page.waitForFunction(()=>typeof window.__queueResolve==="function");
  assert.equal(await page.locator("[data-xoxo-conversation-beta-report]").count(),0);
  await page.evaluate(()=>{
   window.__authEvents("SIGNED_OUT",null);
   window.__queueResolve({ok:true,reports:[window.__testRow||{
    id:"dddddddd-dddd-4ddd-8ddd-000000000001",
    reporter_id:"11111111-1111-4111-8111-111111111111",
    reported_user_id:"22222222-2222-4222-8222-222222222222",
    reason_code:1,details:"Synthetic browser-only report",
    evidence_count:2,status:"pending",
    created_at:"2026-10-25T15:00:00Z",source:"conversation_beta"
   }]});
   window.__holdQueue=false;
  });
  await page.waitForTimeout(100);
  assert.equal(await page.locator("[data-xoxo-conversation-beta-report]").count(),0,
    engine+" displayed a stale authenticated server response");

  await page.locator("[data-xoxo-safety-report-unlock]").click();
  await page.locator("[data-xoxo-conversation-beta-report]").waitFor();
  const before=await page.evaluate(()=>window.__loadCount);
  // A late STATUS update must not invoke the former admin loader.
  await page.evaluate(()=>{window.__holdStatus=true});
  await page.locator(".xmm-report-actions button").nth(1).click();
  await page.waitForFunction(()=>typeof window.__statusResolve==="function");
  await page.evaluate(()=>{
    window.__authEvents("SIGNED_OUT",null);
    window.__statusResolve({ok:true});
    window.__holdStatus=false;
  });
  await page.waitForTimeout(100);
  assert.equal(await page.locator("[data-xoxo-conversation-beta-report]").count(),0);
  assert.equal(await page.evaluate(()=>window.__loadCount),before,
    engine+" late status update reloaded admin reports after logout");

  await page.locator("[data-xoxo-safety-report-unlock]").click();
  await page.locator("[data-xoxo-conversation-beta-report]").waitFor();
  await page.evaluate(()=>window.dispatchEvent(new Event("pagehide")));
  assert.equal(await page.locator("[data-xoxo-conversation-beta-report]").count(),0,
    engine+" kept sensitive report metadata after pagehide");

  // A PIN authorization popup can remain open during a logout. Completing
  // that popup later must NOT unlock the new account or call the RPC.
  await page.evaluate(async()=>{
    await window.loadXoxoDmReports();
    window.__holdPin=true;
  });
  const beforePendingPin=await page.evaluate(()=>window.__loadCount);
  await page.locator("[data-xoxo-safety-report-unlock]").click();
  await page.waitForFunction(()=>typeof window.__pinResolve==="function");
  await page.evaluate(({reason})=>{
    window.__authEvents("SIGNED_OUT",null);
    window.__pinResolve({reason});
    window.__holdPin=false;
  },{reason});
  await page.waitForTimeout(100);
  assert.equal(await page.locator("[data-xoxo-conversation-beta-report]").count(),0,
    engine+" stale PIN completion exposed report metadata after logout");
  assert.equal(await page.evaluate(()=>window.__loadCount),beforePendingPin,
    engine+" stale PIN completion triggered a server reload after logout");
  assert.deepEqual(errors,[],engine+" uncaught UI errors");
  console.log("PASS: "+engine+" native auth events, stale PIN popup, tab exits, delayed queue/status callbacks and pagehide purge private rows");
 }finally{await context.close()}
}
(async()=>{
 for(const [engine,kit] of [["webkit",webkit],["chromium",chromium]]){
  const browser=await kit.launch({headless:true});
  try{await exercise(browser,engine)}finally{await browser.close()}
 }
})().catch(err=>{console.error(err);process.exitCode=1});
