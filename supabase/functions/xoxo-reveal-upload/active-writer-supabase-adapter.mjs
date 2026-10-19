// XOXO Reveal BETA — trusted server-only writer lease check.
// REVIEW ONLY / NOT DEPLOYED. Must not expose RPC credentials or token.
export function createRevealActiveWriterSupabaseAuthorizer({rpcClient}={}){
 if(typeof rpcClient?.rpc!=='function')
  throw new TypeError('Privileged Supabase RPC client required');
 return async function authorizeActiveWriter({attemptId,senderId,writerToken}={}){
  if(typeof attemptId!=='string'||!attemptId.trim()||
     typeof senderId!=='string'||!senderId.trim()||
     typeof writerToken!=='string'||!writerToken.trim())
   return false;
  try{
   const {data,error}=await rpcClient.rpc('xoxo_reveal_verify_active_writer_v2',{
    p_attempt_id:attemptId,p_sender_id:senderId,p_writer_token:writerToken
   });
   return !error&&data===true;
  }catch{return false;}
 };
}
