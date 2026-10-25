"use strict";
/* Native WebKit/Chromium: real DOM mutations close ONLY the previous chat's
 * private BETA report form/evidence selector. No external network or users.
 */
const assert=require("node:assert/strict");
const path=require("node:path");
const {webkit,chromium}=require("playwright");
const root=__dirname;
const a="11111111-1111-4111-8111-111111111111";
const b="22222222-2222-4222-8222-222222222222";
const c="33333333-3333-4333-8333-333333333333";
const message="dddddddd-dddd-4ddd-8ddd-000000000001";

async function scenario(engine,browserType) {
 const browser=await browserType.launch({headless:true});
 const ctx=await browser.newContext({viewport:{width:390,height:844}});
 const page=await ctx.newPage();
 const errors=[];page.on("pageerror",e=>errors.push(e.message));
 try {
  await page.setContent('<main id="dmChat" style="display:block">'+
    '<header class="dm-chat-header"><span id="peerTitle">First chat</span></header>'+
    '<div id="dmMessages"></div></main>');
  await page.evaluate(({a,b,message})=>{
    window.currentUser={id:a};
    window.currentDmUserId=b;
    window.getFriendHubLanguage=()=> "es";
    window.__noticeCount=0;
    window.alert=()=>{window.__noticeCount++};
    window.__authEvents=null;
    window.supabaseClient={
      auth:{
       getUser:async()=>({data:{user:{id:window.currentUser.id}},error:null}),
       onAuthStateChange:callback=>{
         window.__authEvents=callback;
         return {data:{subscription:{unsubscribe(){}}}};
       }
      },
      from:()=>({}),rpc:async()=>{throw Error("Preview must not call RPC")}
    };
    window.__xoxoCurrentDmMessages=[{
      id:message,sender_id:b,recipient_id:a,
      created_at:"2026-10-25T12:00:00Z",
      content:"A private but entirely fictional evidence message"
    }];
    // This scenario tests reports only; do not open the independent
    // once-per-DM warning while simulating account and peer navigation.
    window.XOXOSafetyReminderBeta={show:()=>false};
  },{a,b,message});
  for(const filename of [
   "stay-safe-report-form.js","stay-safe-evidence-picker.js",
   "stay-safe-browser-flow.js","stay-safe-chat-preview-bridge.js"
  ])await page.addScriptTag({path:path.join(root,filename)});
  assert.equal(await page.evaluate(
    ()=>window.XOXOSafetyChatPreviewBeta.reportWritesEnabled()),false);
  assert.equal(await page.locator("#xoxoSafetyConversationReportBeta").count(),1);
  assert.equal(await page.evaluate(()=>typeof window.__authEvents),"function");

  // The DOM may still contain a stale SPA user while Supabase is loading
  // the INITIAL_SESSION. No reporting UI may appear until verified.
  assert.equal(await page.evaluate(
    ()=>window.XOXOSafetyChatPreviewBeta.openReport()),false);
  assert.equal(await page.evaluate(()=>document.getElementById(
    "xoxoSafetyConversationReportBeta").hidden),true);
  await page.evaluate(()=>window.__authEvents("INITIAL_SESSION",null));
  assert.equal(await page.evaluate(
    ()=>window.XOXOSafetyChatPreviewBeta.openReport()),false,
    engine+" null initial Auth session exposed old UI");
  await page.evaluate(({a})=>window.__authEvents("INITIAL_SESSION",{
    user:{id:a,is_anonymous:false}
  }),{a});
  assert.equal(await page.evaluate(()=>document.getElementById(
    "xoxoSafetyConversationReportBeta").hidden),false);
  // A token refresh that revokes the session must immediately hide the
  // currently displayed account, even without a SIGNED_OUT notification.
  await page.evaluate(()=>window.__authEvents("TOKEN_REFRESHED",null));
  assert.equal(await page.evaluate(
    ()=>window.XOXOSafetyChatPreviewBeta.openReport()),false);
  await page.evaluate(({a})=>window.__authEvents("TOKEN_REFRESHED",{
    user:{id:a,is_anonymous:true}
  }),{a});
  assert.equal(await page.evaluate(
    ()=>window.XOXOSafetyChatPreviewBeta.openReport()),false,
    engine+" anonymous Supabase Auth leaked reporting UI");
  await page.evaluate(({a})=>window.__authEvents("SIGNED_IN",{
    user:{id:a,is_anonymous:false}
  }),{a});

  // A peer change triggers the installed *native* MutationObserver.
  assert.equal(await page.evaluate(()=>window.XOXOSafetyChatPreviewBeta.openReport()),true);
  await page.locator("[data-xoxo-report-beta]").waitFor();
  await page.evaluate(({c})=>{
    window.currentDmUserId=c;
    document.getElementById("peerTitle").textContent="New conversation";
  },{c});
  await page.waitForFunction(()=>!document.querySelector("[data-xoxo-report-beta]"));
  assert.equal(await page.locator("[data-xoxo-evidence-beta]").count(),0);

  // Show an evidence picker for this chat, then change the conversation
  // before choosing evidence; the *previous DM's private text* must vanish.
  await page.evaluate(({a,c,message})=>{
    window.__xoxoCurrentDmMessages=[{
      id:message,sender_id:c,recipient_id:a,
      content:"Confidential synthetic message in other conversation",
      created_at:"2026-10-25T12:10:00Z"
    }];
    window.XOXOSafetyChatPreviewBeta.openReport();
  },{a,c,message});
  await page.locator("[data-xoxo-report-beta]").waitFor();
  await page.evaluate(()=>{
    document.querySelector("[data-xoxo-report-beta] form")
      .onsubmit({preventDefault(){}});
  });
  await page.locator("[data-xoxo-evidence-beta]").waitFor();
  const pickerOpen=await page.locator("[data-xoxo-evidence-beta]").textContent();
  assert.ok(pickerOpen.includes("Confidential synthetic message"),
    "The preview should show the current conversation before switching");
  await page.evaluate(({b})=>{
    window.currentDmUserId=b;
    document.getElementById("peerTitle").textContent="Back to first chat";
  },{b});
  await page.waitForFunction(()=>!document.querySelector("[data-xoxo-evidence-beta]"));
  assert.equal(await page.locator("[data-xoxo-report-beta]").count(),0);

  // Display style changes and Auth callbacks must close dialogs too.
  await page.evaluate(()=>window.XOXOSafetyChatPreviewBeta.openReport());
  await page.locator("[data-xoxo-report-beta]").waitFor();
  await page.evaluate(()=>document.getElementById("dmChat").style.display="none");
  await page.waitForFunction(()=>!document.querySelector("[data-xoxo-report-beta]"));
  await page.evaluate(()=>{
    document.getElementById("dmChat").style.display="block";
    window.XOXOSafetyChatPreviewBeta.openReport();
  });
  await page.locator("[data-xoxo-report-beta]").waitFor();
  await page.evaluate(()=>window.__authEvents("SIGNED_OUT",null));
  await page.waitForFunction(()=>!document.querySelector("[data-xoxo-report-beta]"));

  // The SPA may redraw the OLD chat after Auth signed out but before it
  // clears window.currentUser. Never rebuild the old report modal.
  await page.evaluate(()=>{
    document.getElementById("peerTitle").textContent="Stale post-logout header";
    document.getElementById("dmMessages").textContent="Old UI rerender";
  });
  await page.waitForFunction(()=>document.getElementById(
    "xoxoSafetyConversationReportBeta")?.hidden===true);
  assert.equal(await page.evaluate(
    ()=>window.XOXOSafetyChatPreviewBeta.visibleContext()),null);
  assert.equal(await page.evaluate(
    ()=>window.XOXOSafetyChatPreviewBeta.openReport()),false);
  assert.equal(await page.locator("[data-xoxo-report-beta]").count(),0);

  // A NEW Auth identity must not revive the previous account's old DOM.
  await page.evaluate(({c})=>window.__authEvents("SIGNED_IN",{
    user:{id:c}
  }),{c});
  assert.equal(await page.evaluate(
    ()=>window.XOXOSafetyChatPreviewBeta.visibleContext()),null,
    "New sign-in must not use the previous account's stale currentUser");
  // Once the SPA installs the newly signed-in identity, reporting can
  // reopen normally and new UI is still owned by the correct flow.
  await page.evaluate(({c})=>{
    window.currentUser={id:c};
    window.currentDmUserId="11111111-1111-4111-8111-111111111111";
    window.XOXOSafetyChatPreviewBeta.refresh();
  },{c});
  assert.equal(await page.evaluate(
    ()=>window.XOXOSafetyChatPreviewBeta.openReport()),true);
  await page.locator("[data-xoxo-report-beta]").waitFor();
  await page.evaluate(()=>window.dispatchEvent(new Event("pagehide")));
  await page.waitForFunction(()=>!document.querySelector("[data-xoxo-report-beta]"));
  assert.equal(await page.evaluate(()=>window.__noticeCount),0);
  assert.deepEqual(errors,[],engine+" browser exceptions");
  console.log("PASS: "+engine+
   " native chat peer/header change, evidence privacy, hidden chat and SIGNED_OUT close BETA dialogs");
 } finally {
  await ctx.close();await browser.close();
 }
}
(async()=>{
 await scenario("webkit",webkit);
 await scenario("chromium",chromium);
})().catch(e=>{console.error(e);process.exitCode=1});
