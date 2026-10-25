"use strict";
const {submitPreparedConversationReport}=require("./report-submission-orchestrator.cjs");
const {createReportRpcWriter}=require("./report-rpc-writer.cjs");

/**
 * Single entry point for the BETA report flow.
 * Only call once the server-side xoxo_submit_conversation_report_beta RPC
 * is deployed and audited. This does not deploy that RPC or change the UI.
 * The same authenticated user-scoped client is used for RLS reads and RPC.
 */
async function submitConversationReportBeta(authenticatedClient, input) {
  if(typeof authenticatedClient?.auth?.getUser!=="function" ||
     typeof authenticatedClient?.from!=="function" ||
     typeof authenticatedClient?.rpc!=="function") {
    return {ok:false,reason:"invalid_client"};
  }
  return submitPreparedConversationReport(
    authenticatedClient,input,createReportRpcWriter(authenticatedClient)
  );
}
module.exports={submitConversationReportBeta};
