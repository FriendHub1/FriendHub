// XOXO Reveal BETA — current DM send authorization, read-only.
// REVIEW ONLY / NOT DEPLOYED. Requires a privileged server-only database
// client. Mirrors audited direct_messages INSERT policy (2026-10-19):
// existing DM or accepted request, distinct users, no blocks either way.
// This check is advisory to a later transactional send/finalize gate;
// separate reads are not atomic with a concurrent block or account deletion.
export function createRevealDmSendAuthorizer({dbClient}={}){
 if(typeof dbClient?.from!=='function')
  throw new TypeError('Privileged DM authorization database client required');
 return async function verifyDmAuthorization(input={}){
  if(input===null||typeof input!=='object'||Array.isArray(input))
   throw new TypeError('Invalid DM authorization request');
  const {senderId,recipientId,authenticatedSenderId}=input;
  const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if([senderId,recipientId,authenticatedSenderId].some(x=>typeof x!=='string'||!uuid.test(x))||
    senderId!==authenticatedSenderId||senderId===recipientId)
   return false;
  try{
   const blocked=await dbClient.from('user_blocks').select('id')
    .or(`and(blocker_id.eq.${senderId},blocked_id.eq.${recipientId}),and(blocker_id.eq.${recipientId},blocked_id.eq.${senderId})`)
    .limit(1);
   if(blocked.error||!Array.isArray(blocked.data)||blocked.data.length>0)return false;
   const dm=await dbClient.from('direct_messages').select('id')
    .or(`and(sender_id.eq.${senderId},recipient_id.eq.${recipientId}),and(sender_id.eq.${recipientId},recipient_id.eq.${senderId})`)
    .limit(1);
   if(dm.error||!Array.isArray(dm.data))return false;
   let permitted=dm.data.length>0;
   if(!permitted){
    const accepted=await dbClient.from('message_requests').select('id')
     .eq('status','accepted')
     .or(`and(sender_id.eq.${senderId},recipient_id.eq.${recipientId}),and(sender_id.eq.${recipientId},recipient_id.eq.${senderId})`)
     .limit(1);
    if(accepted.error||!Array.isArray(accepted.data))return false;
    permitted=accepted.data.length>0;
   }
   if(!permitted)return false;
   // Re-read blocks after the relationship lookup: a block created while
   // that query was running must not be silently accepted.
   const finalBlocks=await dbClient.from('user_blocks').select('id')
    .or(`and(blocker_id.eq.${senderId},blocked_id.eq.${recipientId}),and(blocker_id.eq.${recipientId},blocked_id.eq.${senderId})`)
    .limit(1);
   return !finalBlocks.error&&Array.isArray(finalBlocks.data)&&finalBlocks.data.length===0;
  }catch{return false;}
 };
}
// Caller MUST obtain authenticatedSenderId from verified auth, never HTTP body.
// A fresh privileged check and transactional protections are required at send.
