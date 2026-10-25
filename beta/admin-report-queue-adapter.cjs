"use strict";
/**
 * BETA: read-only queue adapter for XOXO's existing Message Reports panel.
 * Existing production RPC: get_xoxo_dm_reports.
 * Future, NOT deployed: get_xoxo_conversation_reports_beta.
 * This never replaces the existing report RPC, never fetches DM content,
 * and does not claim that the existing status-update RPC handles BETA IDs.
 */
async function loadCombinedDmReportQueue(client,{includeBeta=false}={}) {
  if(typeof client?.rpc!=="function") return {ok:false,reason:"invalid_client"};
  let existing;
  try { existing=await client.rpc("get_xoxo_dm_reports"); }
  catch { return {ok:false,reason:"existing_reports_unavailable"}; }
  if(existing?.error || !Array.isArray(existing?.data))
    return {ok:false,reason:"existing_reports_unavailable"};
  const legacy=existing.data.map(r=>({...r,report_source:"existing"}));
  if(!includeBeta) return {ok:true,reports:legacy,betaAvailable:false};
  let beta;
  try { beta=await client.rpc("get_xoxo_conversation_reports_beta"); }
  catch { return {ok:true,reports:legacy,betaAvailable:false}; }
  if(beta?.error || !Array.isArray(beta?.data))
    return {ok:true,reports:legacy,betaAvailable:false};
  const extra=beta.data.filter(r=>r && typeof r==="object" && !Array.isArray(r) &&
    typeof r.id==="string" && typeof r.reporter_id==="string" &&
    typeof r.other_user_id==="string").map(r=>({
      id:r.id,reporter_id:r.reporter_id,reported_user_id:r.other_user_id,
      reason:r.reason_code,details:r.details,status:r.status,
      created_at:r.created_at,evidence_count:r.evidence_count,
      report_source:"conversation_beta"
    }));
  return {ok:true,reports:[...legacy,...extra],betaAvailable:true};
}
module.exports={loadCombinedDmReportQueue};
