"use strict";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
/**
 * Convert an authenticated report queue record into an existing DM conversation
 * pair, for reuse with xoxo_admin_list_dm_conversations and
 * openXoxoDmConversation (which performs its own PIN authorization).
 * This module does not read messages, authorize admins or bypass the PIN.
 */
function findReportedConversation(report,conversations){
  if(!report || typeof report!=="object" || !Array.isArray(conversations))return null;
  const a=report.reporter_id,b=report.other_user_id;
  if(typeof a!=="string" || typeof b!=="string" || !UUID.test(a) || !UUID.test(b) || a.toLowerCase()===b.toLowerCase())return null;
  return conversations.find(c=>c && typeof c.user_1==="string" && typeof c.user_2==="string" &&
    ((c.user_1.toLowerCase()===a.toLowerCase() && c.user_2.toLowerCase()===b.toLowerCase()) ||
     (c.user_1.toLowerCase()===b.toLowerCase() && c.user_2.toLowerCase()===a.toLowerCase())))||null;
}
module.exports={findReportedConversation};
