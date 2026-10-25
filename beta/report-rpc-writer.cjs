"use strict";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * BETA RPC transport adapter. The named RPC is NOT installed in production.
 * Only use after a server-side RPC has been audited to reauthorize evidence,
 * enforce idempotency/rate limits, and commit report + evidence atomically.
 * This adapter itself provides no authorization or persistence.
 */
function createReportRpcWriter(client) {
  return async function writeReport(report) {
    if(typeof client?.rpc!=="function" || !report || typeof report!=="object")
      return {ok:false};
    const {otherUserId,reasonCode,details,messageIds,idempotencyKey}=report;
    if(typeof otherUserId!=="string" || !UUID.test(otherUserId) ||
       !Number.isInteger(reasonCode) || reasonCode<0 || reasonCode>5 ||
       typeof details!=="string" || details.length>2000 ||
       !Array.isArray(messageIds) || messageIds.length<1 || messageIds.length>20 ||
       messageIds.some(id=>typeof id!=="string" || !UUID.test(id)) ||
       new Set(messageIds.map(id=>id.toLowerCase())).size!==messageIds.length ||
       typeof idempotencyKey!=="string" || !UUID.test(idempotencyKey))
      return {ok:false};
    try {
      const {data,error}=await client.rpc("xoxo_submit_conversation_report_beta",{
        p_other_user_id:otherUserId,
        p_reason_code:reasonCode,
        p_details:details,
        p_message_ids:messageIds,
        p_idempotency_key:idempotencyKey
      });
      if(error || typeof data!=="string" || !UUID.test(data)) return {ok:false};
      return {ok:true,reportId:data};
    } catch { return {ok:false}; }
  };
}
module.exports={createReportRpcWriter};
