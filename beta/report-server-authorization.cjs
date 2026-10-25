/* XOXO Avenue BETA: pure server-side authorization predicate.
 * Call only AFTER verified Supabase Auth; never trust reporterId from request.
 * messages must come from a privileged, parameterized database lookup, not client.
 * This helper does NOT persist reports, bypass RLS or verify visibility/clears.
 */
"use strict";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function authorizeEvidence({authenticatedUserId,otherUserId,messageIds,messages}={}){
 if(!UUID.test(authenticatedUserId||"")||!UUID.test(otherUserId||"")||
    authenticatedUserId.toLowerCase()===otherUserId.toLowerCase())
  return {ok:false,error:"invalid_participants"};
 if(!Array.isArray(messageIds)||messageIds.length<1||messageIds.length>20||
    messageIds.some(id=>!UUID.test(id))||
    new Set(messageIds.map(id=>id.toLowerCase())).size!==messageIds.length)
  return {ok:false,error:"invalid_selection"};
 if(!Array.isArray(messages))return {ok:false,error:"missing_database_messages"};
 const byId=new Map();
 for(const m of messages){
  if(!m||!UUID.test(m.id||""))return {ok:false,error:"invalid_database_result"};
  const id=m.id.toLowerCase();
  if(byId.has(id))return {ok:false,error:"duplicate_database_result"};
  byId.set(id,m);
 }
 if(byId.size!==messageIds.length)return {ok:false,error:"evidence_mismatch"};
 const self=authenticatedUserId.toLowerCase(),peer=otherUserId.toLowerCase();
 for(const id of messageIds){
  const m=byId.get(id.toLowerCase());
  if(!m)return {ok:false,error:"evidence_mismatch"};
  const sender=String(m.sender_id||"").toLowerCase();
  const recipient=String(m.recipient_id||"").toLowerCase();
  if(!((sender===self&&recipient===peer)||(sender===peer&&recipient===self)))
   return {ok:false,error:"unauthorized_message"};
 }
 return {ok:true};
}
module.exports={authorizeEvidence};
