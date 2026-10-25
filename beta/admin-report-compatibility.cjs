"use strict";
/**
 * BETA-only adapter for the existing XOXO admin report cards.
 * Existing index.html uses get_xoxo_dm_reports and fields:
 * id, reporter_id, reported_user_id, reason, details, status, created_at.
 * The new conversation-report RPC must be added server-side separately.
 * This module does not query, bypass moderation PIN, or change production.
 */
const REASONS=["harassment","spam","inappropriate","threats","other","other"];
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function normalizeConversationReportForAdmin(row) {
  if(!row || typeof row!=="object" || Array.isArray(row) ||
     typeof row.id!=="string" || !UUID.test(row.id) ||
     typeof row.reporter_id!=="string" || !UUID.test(row.reporter_id) ||
     typeof row.other_user_id!=="string" || !UUID.test(row.other_user_id) ||
     !Number.isInteger(row.reason_code) || row.reason_code<0 || row.reason_code>5)
    return null;
  const allowed=["pending","reviewed","resolved","dismissed"];
  const status=allowed.includes(row.status)?row.status:"pending";
  return {
    id:row.id,
    reporter_id:row.reporter_id,
    reported_user_id:row.other_user_id,
    reason:REASONS[row.reason_code],
    details:typeof row.details==="string"?row.details.slice(0,2000):"",
    status,
    created_at:row.created_at||null,
    report_kind:"conversation",
    status_rpc:"update_xoxo_conversation_report_status_beta",
    evidence_count:Number.isInteger(row.evidence_count)&&row.evidence_count>=1&&row.evidence_count<=20?row.evidence_count:null
  };
}
function mergeAdminReportQueues(legacyRows, conversationRows) {
  const legacy=Array.isArray(legacyRows)?legacyRows.filter(row=>row&&typeof row==="object"&&!Array.isArray(row)).map(row=>({...row,report_kind:"legacy",status_rpc:"update_xoxo_dm_report_status"})):[];
  const modern=Array.isArray(conversationRows)?conversationRows.map(normalizeConversationReportForAdmin).filter(Boolean):[];
  return [...legacy,...modern].sort((a,b)=>{
    const left=Date.parse(a.created_at||"")||0;
    const right=Date.parse(b.created_at||"")||0;
    return right-left;
  });
}
module.exports={normalizeConversationReportForAdmin,mergeAdminReportQueues};
