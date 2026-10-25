"use strict";
/* Execute the actual Worker preview branch with synthetic HTML and requests.
 * No network, real accounts, database, or Cloudflare deployment is involved.
 */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const worker=fs.readFileSync(path.join(__dirname,"..","worker.js"),"utf8");
const start=worker.indexOf("// Stay Safe, Sweetheart! — opt-in BETA only on workers.dev.");
const end=worker.indexOf("const xoxoShareLanguage =",start);
assert.ok(start>0 && end>start,"the real opt-in Worker handler is present");
const source=worker.slice(start,end);

async function preview(hostname,flags,method="GET",contentType="text/html"){
  let scripts="",fetches=0;
  const url=new URL(`https://${hostname}/?${flags}`);
  const request={method};
  const env={ASSETS:{fetch:async()=>{
    fetches++;
    return new Response("<html><head></head><body></body></html>",
      {headers:{"content-type":contentType}});
  }}};
  class HTMLRewriter {
    on(selector,handler){
      assert.equal(selector,"head");
      this.handler=handler;
      return this;
    }
    transform(response){
      this.handler.element({append(text,options){
        assert.equal(options.html,true);
        scripts+=text;
      }});
      return response;
    }
  }
  // A no-match return here models fallthrough to the site's normal page.
  const run=new Function("url","request","env","HTMLRewriter","Headers","Response",
    `return (async()=>{${source}\nreturn null;})()`);
  const response=await run(url,request,env,HTMLRewriter,Headers,Response);
  return {response,scripts,fetches};
}

(async()=>{
  const chat="xoxo_safety_chat_beta=1";
  const admin="xoxo_safety_admin_beta=1";
  const allChat=["stay-safe-sweetheart","stay-safe-report-form",
    "stay-safe-evidence-picker","stay-safe-browser-report-adapter",
    "stay-safe-browser-flow","stay-safe-chat-preview-bridge"];
  const allAdmin=["admin-report-queue","admin-report-panel-bridge"];
  for(const [flags,expected,marker] of [
    [chat,allChat,"safety-chat-beta-opt-in"],
    [admin,allAdmin,"admin-report-beta-opt-in"],
    [chat+"&"+admin,[...allChat,...allAdmin],"safety-combined-beta-opt-in"]
  ]){
    const result=await preview("xoxo-example.workers.dev",flags);
    assert.equal(result.fetches,1,"one asset read even with both flags");
    assert.equal(result.response.headers.get("Cache-Control"),"no-store");
    assert.equal(result.response.headers.get("X-XOXO-Worker"),marker);
    const actual=[...result.scripts.matchAll(/src="\/beta\/([^"/]+)\.js"/g)]
      .map(match=>match[1]);
    assert.deepEqual(actual,expected,"inject exactly the intended ordered modules");
    assert.equal(new Set(actual).size,actual.length,"no duplicate or competing scripts");
  }
  for(const [hostname,flags,method,type] of [
    ["xoxoavenue.com",chat+"&"+admin,"GET","text/html"],
    ["www.xoxoavenue.com",chat+"&"+admin,"GET","text/html"],
    ["xoxo-example.workers.dev","","GET","text/html"],
    ["xoxo-example.workers.dev",chat+"&"+admin,"POST","text/html"],
    ["xoxo-example.workers.dev",chat+"&"+admin,"GET","application/json"]
  ]){
    const result=await preview(hostname,flags,method,type);
    assert.equal(result.response,null,"ordinary routes must fall through");
    assert.equal(result.scripts,"","no safety scripts injected on unmatched routes");
  }
  console.log("PASS: actual Worker BETA branch combines chat/admin safely; each works alone, no production injection or duplicate modules");
})().catch(error=>{console.error(error);process.exitCode=1;});
