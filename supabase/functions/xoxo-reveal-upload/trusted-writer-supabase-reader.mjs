// XOXO Reveal BETA — privileged writer-state reader.
// REVIEW ONLY / NOT DEPLOYED. A writer must be fenced by a durable,
// independently implemented server-side SQL protocol, not an expired clock.
export function createRevealTrustedWriterReader({verifyWriterFence}={}){
 if(typeof verifyWriterFence!=='function')
  throw new TypeError('Trusted writer fence verifier required');
 return async function readWriter({attemptId,senderId}={}){
  if([attemptId,senderId].some(x=>typeof x!=='string'||!x.trim()))
   throw new TypeError('Invalid writer identifiers');
  const result=await verifyWriterFence({attemptId,senderId});
  if(result?.authoritative!==true||result.attemptId!==attemptId||
     result.senderId!==senderId||
     typeof result.safeForFinalize!=='boolean')
   throw new Error('Trusted writer fence evidence unavailable');
  return {authoritative:true,attemptId,senderId,
   safeForFinalize:result.safeForFinalize};
 };
}
// Do not replace verifyWriterFence with a cached lease or browser boolean.
// No production finalize until durable writer fencing is implemented.

/**
 * Read-only writer seal evidence from a privileged Supabase database client.
 * Finalize SQL independently locks the attempt and rechecks writer_state.
 */
export function createRevealTrustedSealedWriterReader({dbClient}={}){
 if(typeof dbClient?.from!=='function')
  throw new TypeError('Trusted writer database client required');
 return createRevealTrustedWriterReader({
  verifyWriterFence:async ({attemptId,senderId})=>{
   const {data,error}=await dbClient.from('xoxo_reveal_upload_attempts')
    .select('id,sender_id,status,writer_state')
    .eq('id',attemptId).eq('sender_id',senderId).maybeSingle();
   if(error||!data||data.id!==attemptId||data.sender_id!==senderId)
    throw new Error('Trusted writer seal unavailable');
   return {authoritative:true,attemptId,senderId,
    safeForFinalize:data.status==='pending'&&data.writer_state==='sealed'};
  }
 });
}
