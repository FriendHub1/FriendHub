"use strict";
/* Synthetic BETA-only browser tests. Never contacts xoxoavenue.com or Supabase. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { chromium, webkit } = require("playwright");

const root = __dirname;
const captures = path.join(root,"screenshots");
fs.mkdirSync(captures,{recursive:true});
const html = [
  '<!doctype html><html><head><meta charset="UTF-8">',
  '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">',
  '<style>body{margin:0;background:#190f2d;color:white;font:16px system-ui}',
  'main{box-sizing:border-box;padding:15px;max-width:100%}button{min-height:44px}</style>',
  '</head><body><main><h1>XOXO safety BETA</h1>',
  '<button id="previous">Previous focus target</button></main></body></html>'
].join("");
const server = http.createServer((_req,res)=>{
  res.writeHead(200,{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"});
  res.end(html);
});
const user="11111111-1111-4111-8111-111111111111";
const messageId = i => "dddddddd-dddd-4ddd-8ddd-"+i.toString(16).padStart(12,"0");

async function fits(page,selector,label){
  const dimensions=await page.locator(selector).evaluate(el=>{
    const r=el.getBoundingClientRect();
    return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,
      width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth};
  });
  assert.ok(dimensions.left>=-1 && dimensions.right<=dimensions.width+1,
    label+" horizontal overflow "+JSON.stringify(dimensions));
  assert.ok(dimensions.top>=-1 && dimensions.bottom<=dimensions.height+1,
    label+" vertical overflow "+JSON.stringify(dimensions));
  assert.ok(dimensions.scrollWidth<=dimensions.width+2,
    label+" document scroll overflow "+JSON.stringify(dimensions));
}

async function runScenario(browser,engine,viewport,language,url){
  const context=await browser.newContext({
    viewport:{width:viewport.width,height:viewport.height},
    deviceScaleFactor:viewport.mobile?3:1,
    isMobile:viewport.mobile,hasTouch:viewport.mobile,
    locale:language==="es"?"es-ES":language==="it"?"it-IT":"en-US"
  });
  const page=await context.newPage();
  const label=engine+"-"+viewport.width+"x"+viewport.height+"-"+language;
  const errors=[];
  page.on("pageerror",e=>errors.push(e.message));
  try{
    await page.goto(url);
    for(const filename of [
      "stay-safe-sweetheart.js","stay-safe-report-form.js",
      "stay-safe-evidence-picker.js","stay-safe-browser-flow.js"
    ])await page.addScriptTag({path:path.join(root,filename)});
    const opened=await page.evaluate(({user,language})=>{
      const conversationId="responsive-"+language;
      window.__safetyForm=null;
      window.__safetyEvidence=null;
      const messages=Array.from({length:30},(_,i)=>({
        id:"dddddddd-dddd-4ddd-8ddd-"+(i+1).toString(16).padStart(12,"0"),
        text:"Synthetic message "+(i+1)+" — "+"Be careful with links and money. ".repeat(12)
      }));
      return window.XOXOSafetyReminderBeta.show({
        accountId:user,conversationId,locale:language,
        onReport:()=>window.XOXOReportFormBeta.open({
          conversationId,locale:language,
          onContinue:form=>{
            window.__safetyForm=form;
            window.XOXOEvidencePickerBeta.open({
              conversationId,locale:language,messages,
              onContinue:selection=>window.__safetyEvidence=selection
            });
          }
        })
      });
    },{user,language});
    assert.equal(opened,true,"new warning should open");
    await page.locator(".xoxo-safe-dialog").waitFor();
    const initial = await page.locator(".xoxo-safe-dialog").evaluate(el=>{
      const dialog=el.getBoundingClientRect();
      const heading=el.querySelector("#xoxo-safe-title").getBoundingClientRect();
      return {scrollTop:el.scrollTop,
        headingTop:heading.top, headingBottom:heading.bottom,
        dialogTop:dialog.top, dialogBottom:dialog.bottom};
    });
    assert.ok(initial.scrollTop<=1 &&
      initial.headingTop >= initial.dialogTop-1 &&
      initial.headingBottom <= initial.dialogBottom+1,
      label+" must START with visible safety title, not scrolled to bottom: "+
        JSON.stringify(initial));
    await fits(page,".xoxo-safe-dialog",label+" warning");
    await page.screenshot({path:path.join(captures,label+"-warning.png")});
    assert.equal(await page.locator(".xoxo-safe-dialog").getAttribute("aria-modal"),"true");
    assert.equal(await page.locator(".xoxo-safe-dialog button").count(),3);
    // More tips, Report, Acknowledge.
    await page.locator(".xoxo-safe-dialog button").nth(1).click();
    const form=page.locator("[data-xoxo-report-beta] form");
    await form.waitFor();
    assert.equal(await page.locator(".xoxo-safe-backdrop").count(),0);
    await fits(page,"[data-xoxo-report-beta] form",label+" form");
    assert.equal(await form.getAttribute("aria-modal"),"true");
    assert.equal(await form.locator("input[type=radio]").count(),6);
    await page.screenshot({path:path.join(captures,label+"-form.png")});
    await form.locator("input[type=radio]").nth(4).check();
    await form.locator("textarea").fill("Synthetic report text only.");
    await form.locator("button[type=submit]").click();
    const picker=page.locator("[data-xoxo-evidence-beta] section");
    await picker.waitFor();
    assert.equal(await form.count(),0);
    await fits(page,"[data-xoxo-evidence-beta] section",label+" evidence");
    await page.screenshot({path:path.join(captures,label+"-evidence.png")});
    const checkboxes=picker.locator("input[type=checkbox]");
    assert.equal(await checkboxes.count(),30);
    const fullPreviews=picker.locator("details");
    assert.equal(await fullPreviews.count(),30,
      "Long evidence must be compact but expandable, not silently truncated");
    await fullPreviews.first().locator("summary").click();
    assert.equal(await fullPreviews.first().evaluate(el=>el.open),true,
      "Reporter must be able to expand and read full message before selecting");
    await fullPreviews.first().locator("summary").click();
    assert.equal(await fullPreviews.first().evaluate(el=>el.open),false);
    // Explicitly choose most recent as well as 19 older messages.
    await checkboxes.last().check();
    for(let i=0;i<19;i++)await checkboxes.nth(i).check();
    // A 21st checkbox is intentionally reset by application logic.
    // Use click(), not Playwright check(): check() requires it to remain checked.
    await checkboxes.nth(19).click();
    assert.equal(await checkboxes.nth(19).isChecked(),false,
      "21st selected message should be rejected");
    await picker.locator("button").last().focus();
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(()=>document.activeElement?.type),"checkbox",
      "Tab focus must stay inside evidence picker");
    await picker.locator("button").first().click();
    const result=await page.evaluate(({user,language})=>({
      form:window.__safetyForm,evidence:window.__safetyEvidence,
      repeat:window.XOXOSafetyReminderBeta.show({
        accountId:user,conversationId:"responsive-"+language,locale:language
      })
    }),{user,language});
    assert.equal(result.form.reasonCode,4);
    assert.equal(result.evidence.messageIds.length,20);
    assert.ok(result.evidence.messageIds.includes(messageId(30)));
    assert.equal(result.repeat,false,"one-time warning must remain seen per conversation");

    // Real WebKit/Chromium regression: a host may return newest messages FIRST.
    // Always offer the most recent 100 (21..120), not the oldest 100.
    await page.evaluate(({language})=>{
      window.__timestampSelected=null;
      const ordered=Array.from({length:120},(_,i)=>{
        const number=120-i;
        return {
          id:"dddddddd-dddd-4ddd-8ddd-"+number.toString(16).padStart(12,"0"),
          text:"Dated synthetic message "+number,
          created_at:new Date(Date.UTC(2026,9,25,0,0,0)+number*60000).toISOString()
        };
      });
      window.XOXOEvidencePickerBeta.open({
        conversationId:"reverse-dated",locale:language,messages:ordered,
        onContinue:choice=>{window.__timestampSelected=choice;}
      });
    },{language});
    const recent=page.locator("[data-xoxo-evidence-beta] input[type=checkbox]");
    assert.equal(await recent.count(),100);
    assert.equal(await recent.first().getAttribute("value"),messageId(21));
    assert.equal(await recent.last().getAttribute("value"),messageId(120));
    await recent.last().check();
    await page.locator("[data-xoxo-evidence-beta] button").first().click();
    assert.deepEqual(await page.evaluate(()=>window.__timestampSelected.messageIds),
      [messageId(120)],"Must be able to select newest evidence when host is reversed");
    // A detached form/picker might still have a queued click callback.
    // Native WebKit and Chromium must ignore it after Cancel or success.
    const modalLifecycle=await page.evaluate(({language})=>{
      const values={formAfterCancel:0,formRepeated:0,
        pickerAfterCancel:0,pickerRepeated:0,activeOverlays:0};
      const single=[{
        id:"dddddddd-dddd-4ddd-8ddd-000000000001",
        text:"Synthetic safety evidence"
      }];
      window.XOXOReportFormBeta.open({
        conversationId:"cancelled-modal",locale:language,
        onContinue:()=>{values.formAfterCancel++;}
      });
      const cancelledForm=document.querySelector("[data-xoxo-report-beta] form");
      const queuedSubmit=cancelledForm.onsubmit;
      cancelledForm.querySelector('button[type="button"]').click();
      queuedSubmit({preventDefault(){}});
      window.XOXOReportFormBeta.open({
        conversationId:"one-shot-modal",locale:language,
        onContinue:()=>{values.formRepeated++;}
      });
      const currentForm=document.querySelector("[data-xoxo-report-beta] form");
      currentForm.onsubmit({preventDefault(){}});
      currentForm.onsubmit({preventDefault(){}});
      window.XOXOEvidencePickerBeta.open({
        conversationId:"cancelled-evidence",locale:language,messages:single,
        onContinue:()=>{values.pickerAfterCancel++;}
      });
      const cancelledPicker=document.querySelector("[data-xoxo-evidence-beta]");
      cancelledPicker.querySelector('input[type="checkbox"]').checked=true;
      const queuedEvidence=cancelledPicker.querySelector("button").onclick;
      cancelledPicker.querySelectorAll("button")[1].click();
      queuedEvidence();
      window.XOXOEvidencePickerBeta.open({
        conversationId:"one-shot-evidence",locale:language,messages:single,
        onContinue:()=>{values.pickerRepeated++;}
      });
      const currentPicker=document.querySelector("[data-xoxo-evidence-beta]");
      currentPicker.querySelector('input[type="checkbox"]').checked=true;
      const saveEvidence=currentPicker.querySelector("button").onclick;
      saveEvidence();saveEvidence();
      values.activeOverlays=document.querySelectorAll(
        "[data-xoxo-report-beta],[data-xoxo-evidence-beta]").length;
      return values;
    },{language});
    assert.deepEqual(modalLifecycle,{
      formAfterCancel:0,formRepeated:1,
      pickerAfterCancel:0,pickerRepeated:1,activeOverlays:0
    },label+" stale/cancelled modal callbacks must never submit twice");
    // Real DOM regression: navigation disposes ONLY dialogs belonging to
    // the old chat; a stale handler must not leak a previous private message.
    const navLifecycle=await page.evaluate(async ({user,language})=>{
      const counts={oldClosed:0,newPreserved:0,oldPickerClosed:0,
        staleReportSubmissions:0,overlaysAtEnd:0};
      const peer="22222222-2222-4222-8222-222222222222";
      const fakeMessages=[{
        id:"dddddddd-dddd-4ddd-8ddd-000000000001",
        sender_id:peer,recipient_id:user,text:"Synthetic private message",
        created_at:"2026-10-25T12:00:00Z"
      }];
      const createFlow=conversationId=>
        window.XOXOSafetyFlowBeta.create({
          client:{},accountId:user,otherUserId:peer,conversationId,
          locale:language,enabled:false,previewOnly:true,
          getMessages:()=>fakeMessages
        });
      const oldFlow=createFlow("chat-original");
      oldFlow.openReport();
      const oldForm=document.querySelector("[data-xoxo-report-beta] form");
      // The previous form is closed by its owner/user, without disposing
      // the flow; an old flow cannot later dismiss the new chat's modal.
      oldForm.querySelector('button[type="button"]').click();
      const nextFlow=createFlow("chat-new");
      nextFlow.openReport();
      oldFlow.dispose();
      counts.newPreserved=Number(!!document.querySelector(
        "[data-xoxo-report-beta]"));
      // Simulate a new form followed by a report with authorized evidence.
      const nextForm=document.querySelector("[data-xoxo-report-beta] form");
      nextForm.onsubmit({preventDefault(){}});
      await Promise.resolve();await Promise.resolve();
      const picker=document.querySelector("[data-xoxo-evidence-beta]");
      if(!picker)throw Error("New chat picker did not open");
      const staleClick=picker.querySelector("button").onclick;
      picker.querySelector('input[type="checkbox"]').checked=true;
      nextFlow.dispose();
      counts.oldPickerClosed=Number(!document.querySelector(
        "[data-xoxo-evidence-beta]"));
      staleClick();
      counts.staleReportSubmissions=Number(!!document.querySelector(
        "[data-xoxo-evidence-beta]"));
      counts.oldClosed=Number(!document.querySelector(
        "[data-xoxo-report-beta]"));
      const newestFlow=createFlow("chat-third");
      if(!newestFlow.openReport())throw Error("Third chat could not open");
      newestFlow.dispose();
      counts.overlaysAtEnd=document.querySelectorAll(
        "[data-xoxo-report-beta],[data-xoxo-evidence-beta]").length;
      return counts;
    },{user,language});
    assert.deepEqual(navLifecycle,{
      oldClosed:1,newPreserved:1,oldPickerClosed:1,
      staleReportSubmissions:0,overlaysAtEnd:0
    },label+" disposed chat must close its owned dialog but not new chat");

    // Same-chat reopening must dismiss the old *visible evidence picker*,
    // not merely invalidate its callback while old private text remains.
    const sameChat=await page.evaluate(async ({user,language})=>{
      const peer="22222222-2222-4222-8222-222222222222";
      const flow=window.XOXOSafetyFlowBeta.create({
        client:{},accountId:user,otherUserId:peer,
        conversationId:"same-chat",locale:language,
        previewOnly:true,enabled:false,
        getMessages:()=>[{
          id:"dddddddd-dddd-4ddd-8ddd-000000000001",
          sender_id:peer,recipient_id:user,
          text:"Only one private evidence picker should stay visible",
          created_at:"2026-10-25T12:00:00Z"
        }]
      });
      flow.openReport();
      flow.openReport();
      const formsAfterDoubleOpen=document.querySelectorAll(
        "[data-xoxo-report-beta]").length;
      const form=document.querySelector("[data-xoxo-report-beta] form");
      if(!form)throw Error("Missing current report form");
      form.onsubmit({preventDefault(){}});
      await Promise.resolve();await Promise.resolve();
      const pickerBefore=Number(!!document.querySelector(
        "[data-xoxo-evidence-beta]"));
      flow.openReport();
      const evidenceAfterReopen=document.querySelectorAll(
        "[data-xoxo-evidence-beta]").length;
      const formsAfterReopen=document.querySelectorAll(
        "[data-xoxo-report-beta]").length;
      flow.dispose();
      return {
        formsAfterDoubleOpen,pickerBefore,
        evidenceAfterReopen,formsAfterReopen,
        remainingOverlays:document.querySelectorAll(
          "[data-xoxo-report-beta],[data-xoxo-evidence-beta]").length
      };
    },{user,language});
    assert.deepEqual(sameChat,{
      formsAfterDoubleOpen:1,pickerBefore:1,
      evidenceAfterReopen:0,formsAfterReopen:1,remainingOverlays:0
    },label+" reopening a report must close old same-chat evidence UI");

    // The one-time safety warning must ALSO belong to its chat. Leaving
    // before acknowledging may dismiss it, but must NEVER mark it as seen.
    // Otherwise the next conversation is blocked by an orphaned overlay.
    const reminderLifecycle=await page.evaluate(({user,language})=>{
      const peer="22222222-2222-4222-8222-222222222222";
      const create=conversationId=>window.XOXOSafetyFlowBeta.create({
        client:{},accountId:user,otherUserId:peer,
        conversationId,locale:language,previewOnly:true,enabled:false,
        getMessages:()=>[]
      });
      const old=create("notice-owner-old-"+language);
      const next=create("notice-owner-next-"+language);
      const oldKey="xoxo:safety:v1:"+encodeURIComponent(user)+":"+
        encodeURIComponent("notice-owner-old-"+language);
      const nextKey="xoxo:safety:v1:"+encodeURIComponent(user)+":"+
        encodeURIComponent("notice-owner-next-"+language);
      localStorage.removeItem(oldKey);localStorage.removeItem(nextKey);
      const firstOpen=old.showReminder();
      const blockedByOld=next.showReminder();
      const oldClosed=old.dispose() &&
        !document.querySelector(".xoxo-safe-backdrop");
      const oldUnseen=localStorage.getItem(oldKey)===null;
      const nextOpen=next.showReminder();
      old.dispose(); // Repeated disposal cannot close another chat's modal.
      const nextPreserved=!!document.querySelector(".xoxo-safe-backdrop");
      next.dispose();
      const nextUnseen=localStorage.getItem(nextKey)===null;
      const revisit=create("notice-owner-old-"+language);
      const oldReappeared=revisit.showReminder();
      // The actual user's acknowledgement persists, unlike auto-dismissal.
      const close=document.querySelector(".xoxo-safe-dialog button:last-child");
      close.click();
      const acknowledged=localStorage.getItem(oldKey)==="seen";
      const noRepeat=revisit.showReminder()===false;
      revisit.dispose();
      const noResidualOverlay=!document.querySelector(".xoxo-safe-backdrop");
      return {
        firstOpen,blockedByOld,oldClosed,oldUnseen,
        nextOpen,nextPreserved,nextUnseen,oldReappeared,
        acknowledged,noRepeat,noResidualOverlay
      };
    },{user,language});
    assert.deepEqual(reminderLifecycle,{
      firstOpen:true,blockedByOld:false,oldClosed:true,oldUnseen:true,
      nextOpen:true,nextPreserved:true,nextUnseen:true,oldReappeared:true,
      acknowledged:true,noRepeat:true,noResidualOverlay:true
    },label+" owned safety reminder must close without falsely marking seen");

    assert.deepEqual(errors,[],"browser page errors");
    console.log("PASS: "+label+
      " responsive safety, one-shot callbacks, chat-owned warning and evidence disposal");
  }finally{await context.close();}
}

(async()=>{
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  const url="http://127.0.0.1:"+server.address().port;
  const scenarios=[
    {engine:"webkit",browser:webkit,views:[
      {width:320,height:568,mobile:true,locale:"es"},
      {width:390,height:844,mobile:true,locale:"it"}
    ]},
    {engine:"chromium",browser:chromium,views:[
      {width:1280,height:800,mobile:false,locale:"en"}
    ]}
  ];
  try{
    for(const config of scenarios){
      const browser=await config.browser.launch({headless:true});
      try{
        for(const v of config.views)
          await runScenario(browser,config.engine,v,v.locale,url);
      }finally{await browser.close();}
    }
    console.log("PASS: mobile WebKit emulation and desktop Chromium BETA UI");
  }finally{await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;server.close();});
