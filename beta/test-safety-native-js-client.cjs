"use strict";
/* End-to-end BETA JavaScript submission entry point against real self-hosted
 * GoTrue and PostgREST on GitHub Actions loopback ONLY. Fictional accounts,
 * database, JWT signing key and message IDs. No live Supabase connections.
 */
const assert=require("node:assert/strict");
const {randomUUID}=require("node:crypto");
const {submitConversationReportBeta}=require("./submit-conversation-report-beta.cjs");
const browserAdapter=require("./stay-safe-browser-report-adapter.js");
const AUTH="http://127.0.0.1:9999";
const REST="http://127.0.0.1:3002";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function request(base,route,token,body){
  const headers={Accept:"application/json",Authorization:"Bearer "+token};
  if(body!==undefined)headers["Content-Type"]="application/json";
  const response=await fetch(base+route,{method:body===undefined?"GET":"POST",
    headers,body:body===undefined?undefined:JSON.stringify(body),
    signal:AbortSignal.timeout(10000)});
  const raw=await response.text();
  let value;
  try {value=raw?JSON.parse(raw):null;}
  catch {return {ok:false,status:response.status,value:null};}
  return {ok:response.ok,status:response.status,value};
}

function realSessionClient(token){
  let rpcCalls=0;
  return {
    get rpcCalls(){return rpcCalls;},
    auth:{
      async getUser(){
        const result=await request(AUTH,"/user",token);
        return result.ok?{data:{user:result.value},error:null}:
          {data:{user:null},error:{status:result.status}};
      }
    },
    from(table){
      assert.equal(table,"direct_messages","only evidence RLS read is allowed");
      return {select(fields){
        assert.equal(fields,"id,sender_id,recipient_id");
        return {async in(column,ids){
          assert.equal(column,"id");
          assert.ok(Array.isArray(ids)&&ids.length>=1&&ids.length<=20);
          assert.ok(ids.every(id=>typeof id==="string"&&UUID.test(id)));
          const query=new URLSearchParams({select:fields,id:"in.("+ids.join(",")+")"});
          const result=await request(REST,"/direct_messages?"+query,token);
          return result.ok?{data:result.value,error:null}:
            {data:null,error:{status:result.status}};
        }};
      }};
    },
    async rpc(name,args){
      assert.equal(name,"xoxo_submit_conversation_report_beta");
      rpcCalls++;
      const result=await request(REST,"/rpc/"+name,token,args);
      return result.ok?{data:result.value,error:null}:
        {data:null,error:{status:result.status}};
    }
  };
}

async function runActualBrowserFlow(context){
  const client=realSessionClient(context.token);
  const conversationId="isolated-go-true-dm-flow";
  let reportFromReminder=null,continueForm=null,continueEvidence=null;
  let finishStatus;
  const statusResult=new Promise(resolve=>{finishStatus=resolve;});
  // The visual dialogs are simulated here; their real flow callbacks,
  // session-scoped RLS reads and report adapter are NOT mocked.
  const browserRoot={
    crypto:{randomUUID},
    XOXOReportSubmitBrowserBeta:browserAdapter,
    XOXOSafetyReminderBeta:{
      show(options){
        assert.equal(options.accountId,context.expectedUserId);
        assert.equal(options.conversationId,conversationId);
        reportFromReminder=options.onReport;
        return true;
      },
      dismiss(){return true;}
    },
    XOXOReportFormBeta:{
      open(options){
        assert.equal(options.conversationId,conversationId);
        continueForm=options.onContinue;
        return true;
      },
      dismiss(){return true;}
    },
    XOXOEvidencePickerBeta:{
      open(options){
        assert.equal(options.conversationId,conversationId);
        assert.deepEqual(options.messages.map(x=>x.id),[context.messageId]);
        continueEvidence=options.onContinue;
        return true;
      },
      dismiss(){return true;}
    }
  };
  const oldWindow=global.window;
  global.window=browserRoot;
  try {
    const {create}=require("./stay-safe-browser-flow.js");
    const flow=create({client,accountId:context.expectedUserId,
      otherUserId:context.otherUserId,conversationId,locale:"es",
      enabled:true,previewOnly:false,
      getMessages:async()=>{
        const response=await client.from("direct_messages")
          .select("id,sender_id,recipient_id").in("id",[context.messageId]);
        assert.equal(response.error,null);
        return response.data;
      },
      onStatus:finishStatus,
      isContextActive:()=>true});
    assert.equal(flow.showReminder(),true);
    assert.equal(typeof reportFromReminder,"function");
    reportFromReminder();
    assert.equal(typeof continueForm,"function");
    continueForm({conversationId,reasonCode:1,
      details:"Synthetic report from full XOXO warning/form/evidence flow"});
    for(let i=0;i<100 && !continueEvidence;i++)
      await new Promise(resolve=>setTimeout(resolve,20));
    assert.equal(typeof continueEvidence,"function",
      "the real flow did not reach evidence selection after RLS read");
    continueEvidence({conversationId,messageIds:[context.messageId]});
    let timeoutId;
    const deadline=new Promise((_,reject)=>{
      timeoutId=setTimeout(()=>reject(
        new Error("real browser flow did not finish the report RPC")),10000);
    });
    const outcome=await Promise.race([statusResult,deadline]).finally(
      ()=>clearTimeout(timeoutId));
    assert.equal(outcome.ok,true,"browser flow failed: "+outcome.reason);
    assert.match(outcome.reportId,UUID);
    assert.equal(client.rpcCalls,1,"full browser flow must send one atomic report RPC");
    assert.equal(flow.dispose(),true);
    console.log("PASS: actual XOXO safety warning -> form -> evidence picker " +
      "-> real GoTrue/RLS -> browser adapter -> stored report, synthetic dialogs");
  } finally {
    if(oldWindow===undefined)delete global.window;
    else global.window=oldWindow;
  }
}

async function main(){
  let input="";
  for await(const chunk of process.stdin)input+=chunk;
  // The GoTrue JWT enters through stdin, never argv, logs or a source file.
  const context=JSON.parse(input);
  for(const name of ["token","messageId","otherUserId","idempotencyKey"])
    assert.equal(typeof context[name],"string");
  for(const name of ["messageId","otherUserId","idempotencyKey",
    "browserIdempotencyKey","expectedUserId","outsiderUserId"])
    assert.match(context[name],UUID);
  assert.ok(context.token.length>100,"a real GoTrue session JWT is required");
  const payload={otherUserId:context.otherUserId,reasonCode:1,
    details:"Native GoTrue session through real XOXO JavaScript report pipeline",
    messageIds:[context.messageId],idempotencyKey:context.idempotencyKey};
  const client=realSessionClient(context.token);

  if(context.phase==="revoked"){
    const blocked=await submitConversationReportBeta(client,payload);
    assert.equal(blocked.ok,false,"revoked Auth session submitted via JS module");
    const browserBlocked=await browserAdapter.submit(client,{
      ...payload,accountId:context.expectedUserId,
      idempotencyKey:context.browserIdempotencyKey});
    assert.equal(browserBlocked.ok,false,
      "revoked Auth session submitted through browser RPC adapter");
    // GoTrue /user may validate the JWT before PostgREST checks auth.sessions;
    // either layer may reject first. Persistence MUST still fail atomically.
    console.log("PASS: JavaScript submit path rejects revoked native GoTrue session");
    return;
  }
  assert.equal(context.phase,"active");
  const first=await submitConversationReportBeta(client,payload);
  assert.equal(first.ok,true,"real JS submission failed: "+first.reason);
  assert.match(first.reportId,UUID);
  assert.equal(client.rpcCalls,1,"valid JS submission must call one atomic RPC");
  const retry=await submitConversationReportBeta(client,payload);
  assert.deepEqual(retry,first,"JS retry must get the same immutable receipt");
  assert.equal(client.rpcCalls,2);
  assert.equal(typeof context.outsiderToken,"string");
  const outsider=realSessionClient(context.outsiderToken);
  const rejected=await submitConversationReportBeta(outsider,{
    ...payload,idempotencyKey:context.outsiderIdempotencyKey});
  assert.equal(rejected.ok,false,"other real Auth account stole evidence through JS");
  assert.equal(outsider.rpcCalls,0,"cross-account RLS must reject before the RPC");
  console.log("PASS: genuine GoTrue -> JS auth preflight -> PostgREST RLS -> atomic RPC, " +
    "idempotency and outsider rejection; all loopback and synthetic");

  // This is the distinct adapter wired to the actual DM form in the BETA
  // browser. It re-checks Auth both BEFORE and AFTER the RPC response.
  const browserClient=realSessionClient(context.token);
  const browserPayload={...payload,accountId:context.expectedUserId,
    idempotencyKey:context.browserIdempotencyKey};
  const browserFirst=await browserAdapter.submit(browserClient,browserPayload);
  assert.equal(browserFirst.ok,true,
    "real browser report adapter failed: "+browserFirst.reason);
  assert.match(browserFirst.reportId,UUID);
  assert.equal(browserClient.rpcCalls,1);
  const browserRetry=await browserAdapter.submit(browserClient,browserPayload);
  assert.deepEqual(browserRetry,browserFirst,
    "browser adapter retry must return the immutable server receipt");
  assert.equal(browserClient.rpcCalls,2);
  const outsiderBrowser=realSessionClient(context.outsiderToken);
  const outsiderBrowserResult=await browserAdapter.submit(outsiderBrowser,{
    ...browserPayload,accountId:context.outsiderUserId,
    idempotencyKey:context.outsiderIdempotencyKey});
  assert.equal(outsiderBrowserResult.ok,false,
    "browser adapter exposed another user's selected private evidence");
  assert.equal(outsiderBrowser.rpcCalls,0,
    "browser adapter must reject outsider RLS evidence before its RPC");
  console.log("PASS: genuine GoTrue -> actual browser report adapter -> " +
    "PostgREST RLS/RPC, stable retry, outsider denial and post-RPC Auth recheck");
  await runActualBrowserFlow(context);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
