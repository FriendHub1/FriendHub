// XOXO Reveal BETA — trusted server-side writer verification adapter.
// REVIEW ONLY, NOT DEPLOYED. Requires matching durable SQL RPC not yet built.
// Never infer ownership from the client, cached rows, or an expired lease.
export function createRevealWriterVerificationAdapter({rpcClient}={}){
 if(!rpcClient||typeof rpcClient.rpc!=='function')
  throw new TypeError('Trusted server RPC client required');
 return async function verifyWriter({attemptId,senderId,writerToken,phase}={}){
  if(!attemptId||!senderId||!writerToken||
     !['before_upload','after_upload'].includes(phase))
   return false;
  try{
   const {data,error}=await rpcClient.rpc('xoxo_reveal_verify_writer_v1',{
    p_attempt_id:attemptId,p_sender_id:senderId,p_writer_token:writerToken
   });
   return !error&&data===true;
  }catch{return false;}
 };
}
