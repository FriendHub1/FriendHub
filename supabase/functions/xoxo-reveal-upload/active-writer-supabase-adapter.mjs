// XOXO Reveal BETA — trusted server-only writer lease check.
// REVIEW ONLY / NOT DEPLOYED. Must not expose RPC credentials or token.
export function createRevealActiveWriterSupabaseAuthorizer({rpcClient}={}){
 if(typeof rpcClient?.rpc!=='function')
  throw new TypeError('Privileged Supabase RPC client required');
 return async function authorizeActiveWriter({attemptId,senderId,writerToken}={}){
  if(typeof attemptId!=='string'||!attemptId||
     typeof senderId!=='string'||!senderId||
     typeof writerToken!=='string'||!writerToken)
   return false;
  const {data,error}=await rpcClient.rpc('xoxo_reveal_verify_active_writer_v2',{
   p_attempt_id:attemptId,p_sender_id:senderId,p_writer_token:writerToken
  });
  if(error)return false;
  return data===true;
 };
}
