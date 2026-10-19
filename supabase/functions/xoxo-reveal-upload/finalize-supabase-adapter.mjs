// XOXO Reveal BETA — server-only finalize RPC adapter, NOT DEPLOYED.
// Must receive a privileged, trusted RPC client; never expose it to browsers.
// The SQL function rechecks DB bindings, but not Storage byte integrity.
export function createRevealFinalizeSupabaseAdapter({rpcClient}={}){
 if(typeof rpcClient?.rpc!=='function')
  throw new TypeError('Trusted RPC client required');
 return async function finalizeAttempt({
  attemptId,senderId,claimToken,revealId,dmId
 }={}){
  if([attemptId,senderId,claimToken,revealId,dmId]
    .some(v=>typeof v!=='string'||!v))
   throw new TypeError('Missing trusted finalize identifiers');
  const {data,error}=await rpcClient.rpc('xoxo_reveal_finalize_upload_v2',{
   p_attempt_id:attemptId,p_sender_id:senderId,p_claim_token:claimToken,
   p_reveal_id:revealId,p_dm_id:dmId
  });
  if(error)throw new Error('Finalize RPC failed');
  if(data!=='completed'&&data!=='already_completed')
   throw new Error('Unexpected finalize RPC response');
  return data;
 };
}
// Does not authorize a DM, create Reveal records, or verify Storage bytes.
// Keep as a review-only component until a full isolated integration passes.
