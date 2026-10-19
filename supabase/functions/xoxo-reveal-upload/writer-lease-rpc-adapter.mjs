// XOXO Reveal BETA — privileged writer lifecycle RPC adapter.
// REVIEW ONLY / NOT DEPLOYED. Tokens never go to clients or logs.
export function createRevealWriterLeaseRpcAdapter({rpcClient}={}){
 if(typeof rpcClient?.rpc!=='function')
  throw new TypeError('Privileged Supabase RPC client required');
 async function invoke(name,{attemptId,senderId,writerToken},extra={}){
  if([attemptId,senderId,writerToken].some(v=>typeof v!=='string'||!v.trim()))return false;
  if(extra.p_lease_seconds!==undefined&&(!Number.isSafeInteger(extra.p_lease_seconds)||
    extra.p_lease_seconds<1||extra.p_lease_seconds>120))return false;
  try{
   const {data,error}=await rpcClient.rpc(name,{
    p_attempt_id:attemptId,p_sender_id:senderId,
    p_writer_token:writerToken,...extra
   });
   return !error&&data===true;
  }catch{return false;}
 }
 return {
  beginWriter:(identity,leaseSeconds=90)=>invoke('xoxo_reveal_writer_begin_v3',identity,{p_lease_seconds:leaseSeconds}),
  renewWriter:(identity,leaseSeconds=90)=>invoke('xoxo_reveal_renew_writer_lease_v3',identity,{p_lease_seconds:leaseSeconds}),
  sealWriter:identity=>invoke('xoxo_reveal_writer_seal_v3',identity)
 };
}
