"use strict";
const {authenticatedReportPreflight}=require("./report-authenticated-preflight.cjs");
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * BETA submission boundary: validates request and verifies selected evidence.
 * Does not persist reports. A future atomic server RPC must repeat checks.
 * client must be scoped to the authenticated user's JWT.
 */
async function prepareConversationReport(client, input) {
  if(!input || typeof input!=="object" || Array.isArray(input)) return {ok:false,reason:"invalid_input"};
  const {otherUserId,reasonCode,details="",messageIds,idempotencyKey}=input;
  if(typeof otherUserId!=="string" || !UUID.test(otherUserId) ||
     !Number.isInteger(reasonCode) || reasonCode<0 || reasonCode>5 ||
     typeof details!=="string" || details.length>2000 ||
     typeof idempotencyKey!=="string" || !UUID.test(idempotencyKey) ||
     !Array.isArray(messageIds) || messageIds.length<1 || messageIds.length>20 ||
     messageIds.some(id=>typeof id!=="string" || !UUID.test(id)) ||
     new Set(messageIds.map(id=>id.toLowerCase())).size!==messageIds.length) {
    return {ok:false,reason:"invalid_input"};
  }
  const preflight=await authenticatedReportPreflight(client,{otherUserId,messageIds});
  if(!preflight.ok) return preflight;
  return {ok:true,report:{
    otherUserId:otherUserId.toLowerCase(),reasonCode,details,
    messageIds:messageIds.map(id=>id.toLowerCase()),
    idempotencyKey:idempotencyKey.toLowerCase()
  }};
}
module.exports={prepareConversationReport};
