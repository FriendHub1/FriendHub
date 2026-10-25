"use strict";
/**
 * BETA admin report-list adapter for existing XOXO Message Moderation.
 * Current production admin panel uses get_xoxo_dm_reports. Keep that RPC.
 * The new RPC is a FUTURE server-authorized endpoint; it is not deployed.
 * Caller must already have completed the existing admin/PIN authorization.
 * Both RPCs MUST independently enforce server-side admin authorization.
 */
async function loadCombinedDmReports(client,{moderationAuthorized=false}={}) {
  if(!moderationAuthorized || typeof client?.rpc!=="function")
    return {ok:false,reason:"not_authorized",reports:[]};
  let existing;
  try {
    existing=await client.rpc("get_xoxo_dm_reports");
  } catch { return {ok:false,reason:"existing_reports_unavailable",reports:[]}; }
  if(existing?.error || !Array.isArray(existing?.data))
    return {ok:false,reason:"existing_reports_unavailable",reports:[]};
  const reports=existing.data.map(report=>({...report,reportKind:"message"}));
  let newReportsAvailable=false;
  try {
    const result=await client.rpc("get_xoxo_conversation_reports_beta");
    if(!result?.error && Array.isArray(result?.data)) {
      reports.push(...result.data.map(report=>({...report,reportKind:"conversation"})));
      newReportsAvailable=true;
    }
  } catch { /* New RPC not yet deployed; existing reports remain available. */ }
  return {ok:true,reports,newReportsAvailable};
}
module.exports={loadCombinedDmReports};
