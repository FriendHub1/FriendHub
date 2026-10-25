"use strict";
/**
 * BETA-only adapter for the existing admin Message Reports list.
 * The live panel already uses get_xoxo_dm_reports and update_xoxo_dm_report_status.
 * Keep the existing report records unchanged; never route BETA status updates
 * to the legacy update RPC without an explicit server-side implementation.
 */
const REASONS=["harassment","spam","inappropriate","threats","other","other"];
function normalizeBetaConversationReport(record) {
  if(!record || typeof record!=="object" || Array.isArray(record) ||
     typeof record.id!=="string" || typeof record.reporter_id!=="string" ||
     typeof record.other_user_id!=="string" ||
     !Number.isInteger(record.reason_code) || record.reason_code<0 || record.reason_code>5)
    return null;
  const count=Number(record.evidence_count);
  return {
    id:record.id,
    reporter_id:record.reporter_id,
    reported_user_id:record.other_user_id,
    reason:REASONS[record.reason_code],
    details:typeof record.details==="string"?record.details:"",
    created_at:record.created_at||null,
    status:["pending","reviewed","resolved","dismissed"].includes(record.status)?record.status:"pending",
    source:"conversation_beta",
    evidence_count:Number.isInteger(count)&&count>=0&&count<=20?count:null
  };
}
function mergeAdminDmReports(legacy,beta) {
  const existing=Array.isArray(legacy)?legacy.filter(x=>x&&typeof x==="object").map(x=>({...x,source:"legacy"})):[];
  const additional=Array.isArray(beta)?beta.map(normalizeBetaConversationReport).filter(Boolean):[];
  return [...existing,...additional].sort((a,b)=>Date.parse(b.created_at||0)-Date.parse(a.created_at||0));
}
module.exports={normalizeBetaConversationReport,mergeAdminDmReports};
