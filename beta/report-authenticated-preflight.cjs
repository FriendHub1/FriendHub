"use strict";
const {verifyVisibleMessages}=require("./report-rls-check.cjs");

/**
 * A read-only BETA preflight. The caller must supply a Supabase client
 * configured with the requesting user's JWT (never a service-role client).
 * Do not pass a client shared across requests.
 */
async function authenticatedReportPreflight(client, {otherUserId,messageIds}={}) {
  if(typeof client?.auth?.getUser !== "function" || typeof client?.from !== "function") {
    return {ok:false,reason:"invalid_client"};
  }
  let auth;
  try { auth=await client.auth.getUser(); }
  catch { return {ok:false,reason:"authentication_failed"}; }
  if(auth?.error || !auth?.data?.user?.id) {
    return {ok:false,reason:"authentication_failed"};
  }
  try {
    return await verifyVisibleMessages(client,auth.data.user.id,otherUserId,messageIds);
  } catch {
    return {ok:false,reason:"verification_failed"};
  }
}
module.exports={authenticatedReportPreflight};
