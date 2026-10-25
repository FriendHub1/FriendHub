"use strict";
/* Real WebKit/Chromium regression of the two opt-in BETA modules together.
 * Extracts the ORIGINAL PIN, DM viewer and report renderer from index.html.
 * All Supabase calls are simulated; no site, account, or DB is contacted.
 */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {webkit,chromium}=require("playwright");
const root=__dirname;
const index=fs.readFileSync(path.join(root,"..","index.html"),"utf8");
const begin=index.indexOf("async function xoxoModerationPinAuthorize(es){");
const end=index.indexOf("async function loadXoxoAdminDashboard()",begin);
assert.ok(begin>0 && end>begin,"read the site's original PIN + viewer + report functions");
const existing=index.slice(begin,end);
for(const required of ["async function openXoxoDmConversation(c)",
  "async function loadXoxoDmReports()","function renderXoxoDmReports()"])
  assert.ok(existing.includes(required),"missing real site integration: "+required);

const admin="11111111-1111-4111-8111-111111111111";
const peer="22222222-2222-4222-8222-222222222222";
const reportId="dddddddd-dddd-4ddd-8ddd-000000000001";
const messageId="eeeeeeee-eeee-4eee-8eee-000000000001";
const report={id:reportId,reporter_id:admin,reported_user_id:peer,
  reason_code:1,details:"Synthetic evidence for browser-only integration",
  message_ids:[messageId],status:"pending",created_at:"2026-10-25T12:00:00Z"};

async function enterPin(page){
  const dialog=page.locator("#xoxoModerationPinOverlay form");
  await dialog.waitFor();
  await dialog.locator('input[type="password"]').fill("123456");
  await dialog.locator("select").selectOption({index:1});
  await dialog.locator('button[type="submit"]').click();
  await dialog.waitFor({state:"detached"});
}

async function scenario(engine,browserType){
 const browser=await browserType.launch({headless:true});
 const context=await browser.newContext({viewport:{width:390,height:844}});
 const page=await context.newPage();
 const errors=[];
 page.on("pageerror",error=>errors.push(error.message));
 try{
  await page.setContent('<!doctype html><html><body>'+ 
    '<main id="dmChat" style="display:block">'+
    '<header class="dm-chat-header"><span id="peerTitle">Synthetic chat</span></header>'+
    '<div id="dmMessages"></div></main>'+
    '<section id="xoxoAdminModeration" class="active">'+
    '<div id="xmmReportsList"></div><div id="xmmConversationList"></div>'+
    '<div id="xmmSelectedTitle"></div><div id="xmmSelectedSubtitle"></div>'+
    '<div id="xmmSelectedDetails"></div><div id="xmmMessages"></div></section>'+
    '</body></html>');
  await page.evaluate(({admin,peer,messageId,report})=>{
    window.xoxoIsAdmin=true;
    window.currentUser={id:admin};window.currentDmUserId=peer;
    window.getFriendHubLanguage=()=>"es";
    window.xoxoAdminUsers=[];
    window.xoxoAdminDate=value=>value;
    window.xoxoDmProfileButton=id=>{
      const el=document.createElement("button");el.textContent=id.slice(0,8);return el;
    };
    window.renderXoxoDmConversations=()=>{};
    window.xoxoDmMakeMessage=(message)=>{
      const bubble=document.createElement("article");
      bubble.className="xmm-admin-message";
      bubble.textContent=message.content;
      return bubble;
    };
    window.xoxoDmRenderHistory=(viewer,state)=>{
      const intro=document.createElement("div");
      intro.textContent="Original audited viewer: "+state.messages.length+" synthetic messages";
      viewer.replaceChildren(intro,...state.messages.map(message=>
        window.xoxoDmMakeMessage(message,state.conversation)));
    };
    window.__calls=[];
    window.__authListeners=[];
    window.__xoxoCurrentDmMessages=[{
      id:messageId,sender_id:peer,recipient_id:admin,
      content:"Fictional unsafe money request",created_at:"2026-10-25T12:00:00Z"
    }];
    window.supabaseClient={
      auth:{
        onAuthStateChange:fn=>{
          window.__authListeners.push(fn);
          return {data:{subscription:{unsubscribe(){}}}};
        },
        getUser:async()=>({data:{user:{id:admin,is_anonymous:false}},error:null})
      },
      from:()=>{throw Error("Disabled preview must not read live messages")},
      rpc:async(name,args)=>{
        window.__calls.push({name,args});
        if(name==="get_xoxo_dm_reports")return {data:[],error:null};
        if(name==="xoxo_moderation_pin_status")return {data:{configured:true},error:null};
        if(name==="xoxo_moderation_pin_verify")
          return {data:{verified:args?.p_pin==="123456"},error:null};
        if(name==="xoxo_admin_list_conversation_reports_beta")
          return {data:[report],error:null};
        if(name==="xoxo_admin_read_dm_page_pin")return {data:[{
          id:messageId,sender_id:peer,recipient_id:admin,
          content:"Fictional message",created_at:"2026-10-25T12:00:00Z"
        },{
          id:"ffffffff-ffff-4fff-8fff-ffffffffffff",sender_id:admin,recipient_id:peer,
          content:"Unselected synthetic message",created_at:"2026-10-25T12:01:00Z"
        }],error:null};
        if(name==="xoxo_admin_update_conversation_report_beta")
          return {data:true,error:null};
        throw Error("Unexpected RPC: "+name);
      }
    };
  },{admin,peer,messageId,report});
  // The true site function declarations (not replacements) execute in this
  // isolated document with stubbed dependencies; the original viewer exists.
  await page.addScriptTag({content:
    'let xoxoDmHistoryState=null,xoxoDmHistoryToken=0,xoxoDmSelectedKey="";\n'+existing});
  for(const name of [
    "stay-safe-sweetheart.js","stay-safe-report-form.js",
    "stay-safe-evidence-picker.js","stay-safe-browser-report-adapter.js",
    "stay-safe-browser-flow.js","stay-safe-chat-preview-bridge.js",
    "admin-report-queue.js","admin-report-panel-bridge.js"
  ])await page.addScriptTag({path:path.join(root,name)});

  assert.equal(await page.evaluate(()=>window.__authListeners.length),2,
    "both previews must independently subscribe to Auth invalidation");
  assert.equal(await page.locator("#xmmMessages").count(),1,
    "the existing private conversation viewer must not be duplicated");
  await page.evaluate(()=>window.loadXoxoDmReports());
  assert.equal(await page.locator("[data-xoxo-conversation-beta-report]").count(),0);
  assert.equal(await page.evaluate(()=>window.__calls.some(x=>
    x.name==="xoxo_admin_list_conversation_reports_beta")),false,
    "no conversation-report metadata before PIN authorization");
  await page.evaluate(({admin})=>window.__authListeners.forEach(fn=>
    fn("INITIAL_SESSION",{user:{id:admin,is_anonymous:false}})),{admin});
  assert.equal(await page.evaluate(()=>
    document.getElementById("xoxoSafetyConversationReportBeta").hidden),false);
  const warning=page.locator(".xoxo-safe-dialog");
  await warning.waitFor();
  await warning.locator("button").last().click();
  await warning.waitFor({state:"detached"});

  // Real user-side flow: form then an explicitly chosen evidence message.
  assert.equal(await page.evaluate(()=>window.XOXOSafetyChatPreviewBeta.openReport()),true);
  const form=page.locator("[data-xoxo-report-beta] form");
  await form.waitFor();
  assert.equal(await form.locator("input[type=radio]").count(),6);
  await form.locator("input[type=radio]").nth(1).check();
  await form.locator("textarea").fill("Fictional report details");
  await form.locator('button[type="submit"]').click();
  const evidence=page.locator("[data-xoxo-evidence-beta]");
  await evidence.waitFor();
  assert.equal(await evidence.locator('input[type="checkbox"]').count(),1);
  await evidence.locator('input[type="checkbox"]').check();
  await evidence.locator("button").first().click();
  assert.equal(await page.evaluate(()=>window.__calls.some(x=>
    x.name==="xoxo_submit_conversation_report_beta")),false,
    "preview may NEVER send a report to production Supabase");

  // PIN-gated queue is rendered INSIDE the original xmmReportsList.
  await page.locator("[data-xoxo-safety-report-unlock]").click();
  await enterPin(page);
  const card=page.locator("#xmmReportsList [data-xoxo-conversation-beta-report]");
  await card.waitFor();
  assert.equal(await page.locator("#xmmMessages").count(),1);
  assert.equal(await page.evaluate(()=>window.__calls.filter(x=>
    x.name==="xoxo_admin_list_conversation_reports_beta").length),1);

  // A report card must call the ORIGINAL viewer, causing a SECOND PIN check
  // and the existing audited DM reader, never an alternative message reader.
  await card.locator("button").first().click();
  await enterPin(page);
  await page.waitForFunction(()=>document.getElementById("xmmMessages")
    .textContent.includes("Original audited viewer"));
  const calls=await page.evaluate(()=>window.__calls);
  assert.equal(calls.filter(x=>x.name==="xoxo_admin_read_dm_page_pin").length,1);
  const read=calls.find(x=>x.name==="xoxo_admin_read_dm_page_pin");
  assert.equal(read.args.p_user_1,admin);
  assert.equal(read.args.p_user_2,peer);
  assert.ok(read.args.p_reason.length>=10,"an auditable reason is required");
  const marked=page.locator('#xmmMessages [data-xoxo-safety-report-evidence="1"]');
  assert.equal(await marked.count(),1,
    engine+" did not highlight exactly the reported evidence in the original viewer");
  assert.match(await marked.textContent(),/Fictional message/);
  assert.equal(await page.locator('#xmmMessages .xmm-admin-message').count(),2,
    "the original viewer must still show all messages, not a duplicate filtered list");

  // Expiring the BETA PIN must remove evidence decorations already mounted
  // inside the existing viewer, without clearing its own original messages.
  await page.evaluate(()=>{
    const realNow=Date.now;
    try{
      Date.now=()=>realNow()+14*60*1000+1;
      window.dispatchEvent(new Event("focus"));
    }finally{Date.now=realNow}
  });
  assert.equal(await marked.count(),0,
    engine+" left private BETA evidence markers in the original viewer after PIN expiry");
  assert.equal(await page.locator('#xmmMessages .xmm-admin-message').count(),2,
    engine+" removed the original viewer history while clearing BETA markers");

  // Login loss must erase both private evidence and report cards, even when
  // the original admin moderation section is still visible.
  await page.evaluate(()=>window.XOXOSafetyChatPreviewBeta.openReport());
  await page.locator("[data-xoxo-report-beta]").waitFor();
  await page.evaluate(()=>window.__authListeners.forEach(fn=>fn("SIGNED_OUT",null)));
  await page.waitForFunction(()=>!document.querySelector("[data-xoxo-report-beta]") &&
    !document.querySelector("[data-xoxo-conversation-beta-report]"));
  assert.equal(await page.evaluate(()=>window.XOXOSafetyChatPreviewBeta.openReport()),false);
  assert.equal(await page.locator("#xmmMessages").count(),1);
  assert.deepEqual(errors,[],engine+" browser JS errors");
  console.log("PASS: "+engine+" integrated chat warning/report evidence + existing PIN, admin queue, audited original viewer and logout privacy");
 }finally{await context.close();await browser.close()}
}

(async()=>{
 await scenario("webkit",webkit);
 await scenario("chromium",chromium);
})().catch(error=>{console.error(error);process.exitCode=1});
