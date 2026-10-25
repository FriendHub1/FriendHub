"use strict";
const assert=require("node:assert/strict");
const {loadReportQueue,updateReportStatus}=require("./admin-report-queue.js");
const legacyId="11111111-1111-4111-8111-111111111111",betaId="22222222-2222-4222-8222-222222222222";
const reporter="33333333-3333-4333-8333-333333333333",peer="44444444-4444-4444-8444-444444444444";
const legacy={id:legacyId,reporter_id:reporter,reported_user_id:peer,reason:"spam",created_at:"2026-10-20T00:00:00Z",status:"pending"};
const beta={id:betaId,reporter_id:reporter,reported_user_id:peer,reason_code:1,details:"Scary message",status:"pending",message_ids:["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1","aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2","aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3"],created_at:"2026-10-21T00:00:00Z"};
(async()=>{
  const names=[];
  const both=await loadReportQueue({rpc:async(name)=>{names.push(name);return {data:name==="get_xoxo_dm_reports"?[legacy]:[beta],error:null};}});
  assert.equal(both.ok,true);
  assert.deepEqual(names,["get_xoxo_dm_reports","xoxo_admin_list_conversation_reports_beta"]);
  assert.deepEqual(both.reports.map(x=>x.source),["conversation_beta","message"]);
  assert.equal(both.reports[0].reason,"Threats or blackmail");
  assert.equal(both.reports[0].evidence_count,3);
  const duplicateEvidence=await loadReportQueue({rpc:async name=>({data:name==="get_xoxo_dm_reports"?[legacy]:[{...beta,message_ids:[beta.message_ids[0],beta.message_ids[0]]}],error:null})});
  assert.equal(duplicateEvidence.reports.length,1,"duplicate evidence must be rejected");
  const betaOnlyCalls=[];
  const betaOnly=await loadReportQueue({rpc:async name=>{
    betaOnlyCalls.push(name);
    return {data:[beta],error:null};
  }},{includeLegacy:false});
  assert.deepEqual(betaOnlyCalls,["xoxo_admin_list_conversation_reports_beta"],
    "the panel already fetched legacy reports and must not fetch them twice");
  assert.equal(betaOnly.ok,true);
  assert.deepEqual(betaOnly.reports.map(r=>r.source),["conversation_beta"]);
  const oldOnly=await loadReportQueue({rpc:async name=>name==="get_xoxo_dm_reports"?{data:[legacy]}:{data:null,error:{code:"PGRST202"}}});
  assert.equal(oldOnly.ok,true);assert.equal(oldOnly.reports.length,1);assert.equal(oldOnly.warning,"conversation_reports_not_deployed");
  const damaged=await loadReportQueue({rpc:async name=>({data:name==="get_xoxo_dm_reports"?[legacy]:[{...beta,reported_user_id:"bad"}]})});
  assert.equal(damaged.reports.length,1,"malformed conversation report must not display");
  assert.equal(damaged.warning,"conversation_reports_invalid_response",
    "do not silently disguise invalid RPC output as an empty queue");
  const invalidStatus=await loadReportQueue({rpc:async name=>({
    data:name==="get_xoxo_dm_reports"?[legacy]:[{...beta,status:"unknown"}],error:null
  })});
  assert.equal(invalidStatus.warning,"conversation_reports_invalid_response");
  assert.equal(invalidStatus.reports.length,1);
  const duplicateReports=await loadReportQueue({rpc:async name=>({
    data:name==="get_xoxo_dm_reports"?[legacy]:[beta,{...beta}],error:null
  })});
  assert.equal(duplicateReports.warning,"conversation_reports_invalid_response",
    "duplicate report IDs must not be appended");
  assert.equal(duplicateReports.reports.length,1);
  const tooManyReports=await loadReportQueue({rpc:async name=>({
    data:name==="get_xoxo_dm_reports"?[legacy]:Array.from({length:101},(_,i)=>({
      ...beta,id:(i+1).toString(16).padStart(8,"0")+"-1111-4111-8111-111111111111"
    })),error:null
  })});
  assert.equal(tooManyReports.warning,"conversation_reports_invalid_response",
    "the admin RPC must not return more than 100 records");
  assert.deepEqual(await loadReportQueue({rpc:async()=>({error:{code:"42501"}})}),{ok:false,reason:"legacy_reports_unavailable"});
  assert.deepEqual(await loadReportQueue(null),{ok:false,reason:"invalid_client"});
  let invoked=[];
  const writer={rpc:async(name,args)=>{invoked.push({name,args});return {data:true};}};
  assert.deepEqual(await updateReportStatus(writer,both.reports[0],"reviewed"),{ok:true});
  assert.deepEqual(await updateReportStatus(writer,both.reports[1],"resolved"),{ok:true});
  assert.deepEqual(invoked.map(x=>x.name),["xoxo_admin_update_conversation_report_beta","update_xoxo_dm_report_status"]);
  assert.deepEqual(await updateReportStatus(writer,both.reports[0],"delete"),{ok:false,reason:"invalid_request"});
  assert.equal(invoked.length,2,"invalid updates must never invoke RPC");
  assert.deepEqual(await updateReportStatus({rpc:async()=>({data:false})},both.reports[0],"reviewed"),{ok:false,reason:"status_update_failed"});
  console.log("PASS: 10 admin report queue integration scenarios");
})().catch(error=>{console.error(error);process.exitCode=1;});
