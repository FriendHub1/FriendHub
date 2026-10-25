"use strict";
const {prepareConversationReport}=require("./report-submission-preparation.cjs");

/**
 * BETA: orchestrate validated evidence with an injected trusted persistence
 * function. No database writer is bundled here. The writer MUST reauthorize
 * and insert atomically server-side, and enforce idempotency/rate limits.
 */
async function submitPreparedConversationReport(client,input,writeReport) {
  if(typeof writeReport!=="function") return {ok:false,reason:"writer_unavailable"};
  let prepared;
  try { prepared=await prepareConversationReport(client,input); }
  catch { return {ok:false,reason:"preparation_failed"}; }
  if(!prepared?.ok) return prepared;
  try {
    const result=await writeReport(prepared.report);
    if(!result || result.ok!==true || typeof result.reportId!=="string" ||
       !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(result.reportId))
      return {ok:false,reason:"submission_failed"};
    return {ok:true,reportId:result.reportId};
  } catch {
    return {ok:false,reason:"submission_failed"};
  }
}
module.exports={submitPreparedConversationReport};
