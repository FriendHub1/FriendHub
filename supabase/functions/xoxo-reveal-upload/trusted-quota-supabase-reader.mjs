// XOXO Reveal BETA — privileged read-only quota reservation evidence.
// REVIEW ONLY / NOT DEPLOYED. A reserved row is necessary, not sufficient,
// for safe finalization; transactional RPC must recheck writer fencing.
export function createRevealTrustedQuotaReader({dbClient}={}){
 if(typeof dbClient?.from!=='function')
  throw new TypeError('Trusted quota database client required');
 return async function readQuota({attemptId,senderId}={}){
  if([attemptId,senderId].some(x=>typeof x!=='string'||!x.trim()))
   throw new TypeError('Invalid quota identifiers');
  const {data,error}=await dbClient.from('xoxo_reveal_quota_reservations')
   .select('id,upload_attempt_id,sender_id,byte_count,released_at')
   .eq('upload_attempt_id',attemptId).eq('sender_id',senderId).maybeSingle();
  if(error||!data||!data.id||
     data.upload_attempt_id!==attemptId||data.sender_id!==senderId||
     !Number.isSafeInteger(data.byte_count)||data.byte_count<1||
     data.byte_count>15728640)
   throw new Error('Trusted quota reservation unavailable');
  return {authoritative:true,attemptId,senderId,active:data.released_at===null};
 };
}
// Does not reserve, release, refund, or mutate quota. Never use to authorize
// production finalize without transactional revalidation.
