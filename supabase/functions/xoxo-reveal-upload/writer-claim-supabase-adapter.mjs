// XOXO Reveal BETA — server-only Supabase RPC writer adapter.
// NOT DEPLOYED. Caller must supply a privileged server client, never browser JWT.
// This adapter does not guarantee that a Storage write has been fenced.
export function createRevealWriterClaimAdapter({rpcClient}={}){
 if(!rpcClient||typeof rpcClient.rpc!=='function')
  throw new TypeError('Trusted server RPC client required');
 return async function claimWriter({attemptId,senderId,claimToken,writerToken,leaseSeconds=60}={}){
  if(!attemptId||!senderId||!claimToken||!writerToken||
    !Number.isInteger(leaseSeconds)||leaseSeconds<10||leaseSeconds>120)
   throw new TypeError('Invalid writer claim inputs');
  const {data,error}=await rpcClient.rpc('xoxo_reveal_claim_writer_v1',{
   p_attempt_id:attemptId,p_sender_id:senderId,
   p_claim_token:claimToken,p_writer_token:writerToken,
   p_lease_seconds:leaseSeconds
  });
  if(error)throw new Error('Writer claim RPC failed');
  const allowed=['claimed','already_owned','busy','not_found','not_owner','manual_reconciliation'];
  if(typeof data!=='string'||!allowed.includes(data))
   throw new Error('Unexpected writer claim response');
  return data;
 };
}
// No fallback to client RPC, no implicit retry after ambiguous network failure.
