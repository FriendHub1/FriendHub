"use strict";
/* Genuine browser UI -> actual BETA flow -> local GoTrue/PostgREST.
 * Run ONLY in the disposable native-Auth workflow. All HTTP destinations
 * are fixed 127.0.0.1 loopback services with fictional users and DMs.
 */
const assert=require("node:assert/strict");
const http=require("node:http");
const path=require("node:path");
const {webkit,chromium}=require("playwright");
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const root=__dirname;
const PORT=3010;

const html='<!doctype html><html><head><meta charset="UTF-8">'+
  '<meta name="viewport" content="width=device-width,initial-scale=1">'+
  '<style>body{margin:0;background:#190f2d;color:#fff;font:16px system-ui}'+
  'main{padding:18px}button{min-height:44px}</style></head>'+
  '<body><main><h1>Isolated XOXO Safety BETA</h1></main></body></html>';

async function proxyRequest(req,res){
  const requested=new URL(req.url,"http://127.0.0.1:"+PORT);
  if(req.method==="GET"&&requested.pathname==="/"){
    res.writeHead(200,{"Content-Type":"text/html; charset=utf-8",
      "Cache-Control":"no-store"});res.end(html);return;
  }
  let upstream;
  if(requested.pathname==="/api/auth/user")
    upstream="http://127.0.0.1:9999/user";
  else if(requested.pathname==="/api/db/direct_messages" ||
      requested.pathname==="/api/db/rpc/xoxo_submit_conversation_report_beta")
    upstream="http://127.0.0.1:3002"+
      requested.pathname.slice("/api/db".length)+requested.search;
  else {res.writeHead(404);res.end();return;}
  if(req.method!=="GET"&&req.method!=="POST"){
    res.writeHead(405);res.end();return;
  }
  let body="";
  for await(const chunk of req){
    body+=chunk;
    if(body.length>5000){res.writeHead(413);res.end();return;}
  }
  const headers={Accept:"application/json"};
  if(typeof req.headers.authorization==="string")
    headers.Authorization=req.headers.authorization;
  if(req.method==="POST")headers["Content-Type"]="application/json";
  const response=await fetch(upstream,{method:req.method,headers,
    body:req.method==="POST"?body:undefined,signal:AbortSignal.timeout(12000)});
  res.writeHead(response.status,{"Content-Type":response.headers.get("content-type")||
    "application/json","Cache-Control":"no-store"});
  res.end(Buffer.from(await response.arrayBuffer()));
}

async function scenario(engine,browserType,session){
  const browser=await browserType.launch({headless:true});
  const context=await browser.newContext({
    viewport:engine==="webkit"?{width:390,height:844}:{width:1280,height:800},
    isMobile:engine==="webkit",hasTouch:engine==="webkit"
  });
  const page=await context.newPage();
  const errors=[];
  page.on("pageerror",err=>errors.push(err.message));
  try{
    await page.goto("http://127.0.0.1:"+PORT+"/");
    for(const name of ["stay-safe-sweetheart.js","stay-safe-report-form.js",
      "stay-safe-evidence-picker.js","stay-safe-browser-report-adapter.js",
      "stay-safe-browser-flow.js"])
      await page.addScriptTag({path:path.join(root,name)});
    const started=await page.evaluate(({token,user,peer,messageId,engine})=>{
      window.__safetyStatus=null;
      window.__safetyRpcCalls=0;
      const headers={Authorization:"Bearer "+token,Accept:"application/json"};
      const call=async(route,body)=>{
        const response=await fetch(route,{method:body===undefined?"GET":"POST",
          headers:body===undefined?headers:{...headers,"Content-Type":"application/json"},
          body:body===undefined?undefined:JSON.stringify(body)});
        const data=await response.json();
        return response.ok?{data,error:null}:{data:null,error:{status:response.status}};
      };
      const client={
        auth:{getUser:async()=>{
          const result=await call("/api/auth/user");
          return result.error?{data:{user:null},error:result.error}:
            {data:{user:result.data},error:null};
        }},
        from:table=>{
          if(table!=="direct_messages")throw Error("Unexpected table");
          return {select:fields=>({in:(column,ids)=>{
            if(fields!=="id,sender_id,recipient_id"||column!=="id")
              throw Error("Unexpected evidence query");
            const query=new URLSearchParams({select:fields,id:"in.("+ids.join(",")+")"});
            return call("/api/db/direct_messages?"+query);
          }})};
        },
        rpc:async(name,args)=>{
          if(name!=="xoxo_submit_conversation_report_beta")throw Error("Unexpected RPC");
          window.__safetyRpcCalls++;
          return call("/api/db/rpc/"+name,args);
        }
      };
      const getMessages=async()=>{
        const response=await client.from("direct_messages")
          .select("id,sender_id,recipient_id").in("id",[messageId]);
        if(response.error)throw Error("Evidence RLS read failed");
        return response.data;
      };
      window.__flow=window.XOXOSafetyFlowBeta.create({
        client,accountId:user,otherUserId:peer,
        conversationId:"native-browser-"+engine,locale:"es",
        getMessages,enabled:true,previewOnly:false,
        onStatus:result=>{window.__safetyStatus=result;},
        isContextActive:()=>true
      });
      return window.__flow.showReminder();
    },{token:session.token,user:session.user,peer:session.peer,
      messageId:session.messageId,engine});
    assert.equal(started,true,"real flow warning not displayed in "+engine);
    const warning=page.locator(".xoxo-safe-dialog");
    await warning.waitFor();
    assert.equal(await warning.getAttribute("aria-modal"),"true");
    await warning.locator("button").nth(1).click();
    const form=page.locator("[data-xoxo-report-beta] form");
    await form.waitFor();
    assert.equal(await form.locator("input[type=radio]").count(),6);
    await form.locator("input[type=radio]").nth(1).check();
    await form.locator("textarea").fill("Synthetic native-browser safety report");
    await form.locator('button[type="submit"]').click();
    const picker=page.locator("[data-xoxo-evidence-beta]");
    await picker.waitFor();
    assert.equal(await picker.locator('input[type="checkbox"]').count(),1);
    await picker.locator('input[type="checkbox"]').check();
    await picker.locator("button").first().click();
    await page.waitForFunction(()=>window.__safetyStatus!==null,null,{timeout:20000});
    const status=await page.evaluate(()=>({
      report:window.__safetyStatus,rpcCalls:window.__safetyRpcCalls,
      disposed:window.__flow.dispose()
    }));
    assert.equal(status.report?.ok,true,
      engine+" true-browser report failed: "+status.report?.reason);
    assert.match(status.report.reportId,UUID);
    assert.equal(status.rpcCalls,1,"real browser must send exactly one report RPC");
    assert.equal(status.disposed,true);
    assert.deepEqual(errors,[],engine+" browser page errors");
    console.log("PASS: "+engine+" real DOM warning/form/evidence -> " +
      "native GoTrue session -> RLS -> report RPC; fictional local stack");
  }finally{await context.close();await browser.close();}
}

async function main(){
  let input="";
  for await(const chunk of process.stdin)input+=chunk;
  const session=JSON.parse(input);
  assert.equal(typeof session.token,"string");
  assert.ok(session.token.length>100);
  for(const key of ["user","peer","messageId"])assert.match(session[key],UUID);
  const server=http.createServer((req,res)=>{
    void proxyRequest(req,res).catch(()=>{
      if(!res.headersSent)res.writeHead(502);
      res.end();
    });
  });
  await new Promise((resolve,reject)=>server.listen(PORT,"127.0.0.1",err=>
    err?reject(err):resolve()));
  try{
    await scenario("webkit",webkit,session);
    await scenario("chromium",chromium,session);
  }finally{await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
