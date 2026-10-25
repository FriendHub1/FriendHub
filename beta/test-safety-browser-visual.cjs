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
      "stay-safe-evidence-picker.js"
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
    // Explicitly choose most recent as well as 19 older messages.
    await checkboxes.last().check();
    for(let i=0;i<19;i++)await checkboxes.nth(i).check();
    await checkboxes.nth(19).check();
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
    assert.deepEqual(errors,[],"browser page errors");
    console.log("PASS: "+label+" responsive notice, form, selected evidence, focus trap");
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
