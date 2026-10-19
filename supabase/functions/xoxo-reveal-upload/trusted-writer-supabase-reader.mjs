// XOXO Reveal BETA — privileged writer-state reader.
// REVIEW ONLY / NOT DEPLOYED. A writer must be fenced by a durable,
// independently implemented server-side SQL protocol, not an expired clock.
export function createRevealTrustedWriterReader({verifyWriterFence}={}){
 if(typeof verifyWriterFence!=='function')
  throw new TypeError('Trusted writer fence verifier required');
 return async function readWriter({attemptId,senderId}={}){
  if([attemptId,senderId].some(x=>typeof x!=='string'||!x))
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
