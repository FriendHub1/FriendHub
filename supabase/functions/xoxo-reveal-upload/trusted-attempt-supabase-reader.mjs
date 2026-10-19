// XOXO Reveal BETA — server-only attempt evidence from privileged Supabase.
// REVIEW ONLY / NOT DEPLOYED. Inject a service-authorized client exclusively.
export function createRevealTrustedAttemptReader({dbClient}={}){
 if(typeof dbClient?.from!=='function')
  throw new TypeError('Trusted Supabase database client required');
 return async function readAttempt({attemptId,senderId}={}){
  if(typeof attemptId!=='string'||!attemptId||
     typeof senderId!=='string'||!senderId)
   throw new TypeError('Invalid attempt identity');
  const {data,error}=await dbClient.from('xoxo_reveal_upload_attempts')
   .select('id,sender_id,payload_fingerprint,status')
   .eq('id',attemptId).eq('sender_id',senderId).maybeSingle();
  if(error||!data||data.id!==attemptId||data.sender_id!==senderId||
     !/^[a-f0-9]{64}$/.test(data.payload_fingerprint||'')||
     data.status!=='pending')
   throw new Error('Trusted attempt evidence unavailable');
  return {authoritative:true,id:data.id,senderId:data.sender_id,
   payloadFingerprint:data.payload_fingerprint};
 };
}
// A read cannot lock an upload attempt. Finalize RPC must recheck atomically.
