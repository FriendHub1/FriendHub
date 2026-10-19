// XOXO Reveal BETA — privileged durable uncertainty marker adapter.
// REVIEW ONLY / NOT DEPLOYED.
export function createRevealUploadUncertaintyRpcMarker({rpcClient}={}){
 if(typeof rpcClient?.rpc!=='function')
  throw new TypeError('Privileged Supabase RPC client required');
 return async function markUncertain({attemptId,senderId,reason='upload_outcome_uncertain'}={}){
  if(!attemptId||!senderId||reason!=='upload_outcome_uncertain')
   throw new TypeError('Invalid uncertainty marker identity');
  const {data,error}=await rpcClient.rpc('xoxo_reveal_mark_upload_uncertain_v1',{
   p_attempt_id:attemptId,p_sender_id:senderId,p_reason:reason
  });
  if(error||data!==true)throw new Error('Durable uncertainty marker rejected');
  return true;
 };
}
