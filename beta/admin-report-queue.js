/* XOXO Avenue — admin reports adapter (BETA only).
 * Reuses the existing moderation panel. Server RPCs MUST authorize each call.
 * No message contents are requested by this adapter.
 */
(function(root,factory){
  "use strict";
  const api=factory();
  if(typeof module==="object" && module.exports)module.exports=api;
  if(root)root.XOXOAdminReportQueueBeta=api;
})(typeof window!=="undefined"?window:null,function(){
  "use strict";
  const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const statuses=new Set(["pending","reviewed","resolved","dismissed"]);
  const reasons=["Scam or money requests","Threats or blackmail","Harassment or unwanted messages","Fake profile or identity","Intimate photo threats","Other"];
  const rpcBySource=Object.freeze({message:"update_xoxo_dm_report_status",conversation_beta:"xoxo_admin_update_conversation_report_beta"});
  const uuid=value=>typeof value==="string" && UUID.test(value);
  // Match the server's 10–300-character PIN audit reason contract.
  // Reject control characters locally rather than sending a malformed reason
  // to the privileged admin RPC (and potentially logging it elsewhere).
  const validReason=value=>typeof value==="string" &&
    value.trim().length>=10 && value.trim().length<=300 &&
    !/[\u0000-\u001f\u007f-\u009f]/u.test(value);
  function normalizeLegacy(report){
    if(!report || !uuid(report.id))return null;
    return {...report,source:"message"};
  }
  function normalizeConversation(report){
    const reportedId=report?.reported_user_id || report?.other_user_id;
    if(!report || !uuid(report.id) || !uuid(report.reporter_id) || !uuid(reportedId) ||
       report.reporter_id.toLowerCase()===reportedId.toLowerCase() ||
       !Number.isInteger(report.reason_code) || report.reason_code<0 || report.reason_code>5 ||
       typeof report.details!=="string" || report.details.length>2000 ||
       !statuses.has(report.status) || typeof report.created_at!=="string" ||
       !Number.isFinite(Date.parse(report.created_at)))
      return null;
    // The new private-schema RPC returns the selected message IDs, whereas
    // earlier mock adapters returned only evidence_count.
    let count=null;
    let evidenceMessageIds=[];
    if(Array.isArray(report.message_ids)){
      if(report.message_ids.length<1 || report.message_ids.length>20 ||
         report.message_ids.some(id=>!uuid(id)) ||
         new Set(report.message_ids.map(id=>id.toLowerCase())).size!==report.message_ids.length)
        return null;
      count=report.message_ids.length;
      // The original PIN-audited DM viewer can mark exactly these messages;
      // no message text or private attachment URL is copied into the queue.
      evidenceMessageIds=report.message_ids.map(id=>id.toLowerCase());
    }else if(Number.isInteger(report.evidence_count) &&
             report.evidence_count>=1 && report.evidence_count<=20){
      count=report.evidence_count;
    }
    if(count===null)return null;
    let unavailableCount=null;
    if(Object.hasOwn(report,"unavailable_evidence_count")){
      if(!Number.isInteger(report.unavailable_evidence_count) ||
         report.unavailable_evidence_count<0 ||
         report.unavailable_evidence_count>count)return null;
      unavailableCount=report.unavailable_evidence_count;
    }
    return {id:report.id,reporter_id:report.reporter_id,reported_user_id:reportedId,
      reason:reasons[report.reason_code],reason_code:report.reason_code,details:report.details,
      created_at:report.created_at,status:report.status,
      evidence_count:count,evidence_message_ids:evidenceMessageIds,
      unavailable_evidence_count:unavailableCount,
      source:"conversation_beta"};
  }
  async function loadReportQueue(client,{includeLegacy=true,moderationReason}={}){
    if(typeof client?.rpc!=="function" || typeof includeLegacy!=="boolean")
      return {ok:false,reason:"invalid_client"};
    // Reuse the same 10–300 character reason entered in the site's EXISTING
    // PIN + moderation reason dialog; never silently query without a reason.
    if(!validReason(moderationReason))
      return {ok:false,reason:"moderation_reason_required"};
    let reports=[];
    if(includeLegacy){
      let original;
      try{original=await client.rpc("get_xoxo_dm_reports");}
      catch{return {ok:false,reason:"legacy_reports_unavailable"};}
      if(original?.error || !Array.isArray(original?.data))
        return {ok:false,reason:"legacy_reports_unavailable"};
      reports=original.data.map(normalizeLegacy).filter(Boolean);
    }
    let warning=null;
    try{
      const extra=await client.rpc("xoxo_admin_list_conversation_reports_beta",{
        p_reason:moderationReason.trim()
      });
      if(extra?.error){
        warning=["PGRST202","42883"].includes(String(extra.error.code)) 
          ? "conversation_reports_not_deployed" : "conversation_reports_unavailable";
      }else if(Array.isArray(extra?.data)){
        const normalized=extra.data.map(normalizeConversation);
        if(normalized.some(item=>!item) || normalized.length>100 ||
           new Set(normalized.map(item=>item?.id)).size!==normalized.length) {
          // Fail closed: a malformed or duplicated server response must
          // never be silently presented as an empty/partial report queue.
          warning="conversation_reports_invalid_response";
        } else {
          reports.push(...normalized);
        }
      }else warning="conversation_reports_invalid_response";
    }catch{warning="conversation_reports_unavailable";}
    // Match the server queue: never bury an old pending case beneath
    // newer reviewed, resolved or dismissed reports.
    reports.sort((a,b)=>{
      const urgency=Number(b.status==="pending")-Number(a.status==="pending");
      if(urgency)return urgency;
      const aTime=Date.parse(a.created_at||"");const bTime=Date.parse(b.created_at||"");
      const chronological=(Number.isFinite(bTime)?bTime:0)-(Number.isFinite(aTime)?aTime:0);
      return chronological || String(b.id).localeCompare(String(a.id),"en");
    });
    return {ok:true,reports,warning};
  }
  // No offset: follow the (pending, created_at, UUID) order used by the
  // backend, with independently checked PIN/session/reason on EVERY page.
  async function loadMoreReports(client,{moderationReason,cursor,limit=50}={}){
    if(typeof client?.rpc!=="function" || !validReason(moderationReason) ||
       !Number.isInteger(limit) || limit<1 || limit>50 ||
       !cursor || typeof cursor.pending!=="boolean" ||
       !uuid(cursor.id) || typeof cursor.created_at!=="string" ||
       !Number.isFinite(Date.parse(cursor.created_at))) {
      return {ok:false,reason:"invalid_request"};
    }
    let response;
    try {
      response=await client.rpc("xoxo_admin_page_conversation_reports_beta",{
        p_reason:moderationReason.trim(),
        p_after_pending:cursor.pending,
        p_after_created_at:cursor.created_at,
        p_after_id:cursor.id,
        p_limit:limit
      });
    }catch{return {ok:false,reason:"conversation_reports_unavailable"};}
    if(response?.error || !response?.data ||
       typeof response.data!=="object" || Array.isArray(response.data))
      return {ok:false,reason:"conversation_reports_unavailable"};
    const page=response.data;
    if(!Array.isArray(page.reports) || page.reports.length>limit ||
       typeof page.has_more!=="boolean") {
      return {ok:false,reason:"conversation_reports_invalid_response"};
    }
    const reports=page.reports.map(normalizeConversation);
    if(reports.some(item=>!item) ||
       new Set(reports.map(item=>item.id.toLowerCase())).size!==reports.length) {
      return {ok:false,reason:"conversation_reports_invalid_response"};
    }
    let nextCursor=null;
    if(page.has_more){
      const next=page.next_cursor,last=reports.at(-1);
      if(!last || !next || typeof next!=="object" ||
         typeof next.pending!=="boolean" || !uuid(next.id) ||
         !Number.isFinite(Date.parse(next.created_at)) ||
         next.pending!==(last.status==="pending") ||
         next.id.toLowerCase()!==last.id.toLowerCase() ||
         Date.parse(next.created_at)!==Date.parse(last.created_at))
        return {ok:false,reason:"conversation_reports_invalid_response"};
      nextCursor={pending:next.pending,created_at:next.created_at,id:next.id};
    }else if(page.next_cursor!==null){
      return {ok:false,reason:"conversation_reports_invalid_response"};
    }
    return {ok:true,reports,hasMore:page.has_more,nextCursor};
  }

  function cursorAfter(report){
    if(!report || !uuid(report.id) || !statuses.has(report.status) ||
       typeof report.created_at!=="string" ||
       !Number.isFinite(Date.parse(report.created_at)))return null;
    return {pending:report.status==="pending",
      created_at:report.created_at,id:report.id};
  }

  async function updateReportStatus(client,report,status,moderationReason){
    if(typeof client?.rpc!=="function" || !report || !uuid(report.id) ||
       !statuses.has(status) || !Object.hasOwn(rpcBySource,report.source) ||
       (report.source==="conversation_beta" && !validReason(moderationReason)))
      return {ok:false,reason:"invalid_request"};
    try{
      const args={p_report_id:report.id,p_status:status};
      if(report.source==="conversation_beta")args.p_reason=moderationReason.trim();
      const result=await client.rpc(rpcBySource[report.source],args);
      return result?.error || result?.data!==true ? {ok:false,reason:"status_update_failed"}:{ok:true};
    }catch{return {ok:false,reason:"status_update_failed"};}
  }
  return Object.freeze({loadReportQueue,loadMoreReports,cursorAfter,updateReportStatus});
});
