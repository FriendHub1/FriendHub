// XOXO Reveal BETA — trusted private-byte reconciliation evidence.
// REVIEW ONLY / NOT DEPLOYED. Digest validation does not prove quiescence.
export function createRevealReconciliationStorageEvidence({
 readIntegrity,readTrustedFingerprint
}={}){
 if(typeof readIntegrity!=='function'||typeof readTrustedFingerprint!=='function')
  throw new TypeError('Trusted integrity and fingerprint readers required');
 return async function readStorageEvidence({attemptId,senderId,objectBinding}={}){
  if([attemptId,senderId].some(value=>typeof value!=='string'||!value.trim())||
     objectBinding?.attemptId!==attemptId||
     objectBinding?.senderId!==senderId||
     objectBinding?.bucketId!=='xoxo-reveal'||
     typeof objectBinding.objectPath!=='string'||!objectBinding.objectPath.trim()||
     objectBinding.objectPath.startsWith('/')||
     objectBinding.objectPath.includes('..')||
     objectBinding.objectPath.includes('\\')||
     objectBinding.objectPath.includes('?')||
     objectBinding.objectPath.includes('#'))
   return {state:'unavailable',digestMatches:false,writerQuiescent:false};
  try{
   const fingerprint=await readTrustedFingerprint({attemptId,senderId});
   if(!/^[a-f0-9]{64}$/.test(fingerprint||''))
    return {state:'unavailable',digestMatches:false,writerQuiescent:false};
   const integrity=await readIntegrity({
    attemptId,objectPath:objectBinding.objectPath,payloadFingerprint:fingerprint
   });
   if(integrity?.authoritative!==true||integrity.objectPath!==objectBinding.objectPath||
      integrity.payloadFingerprint!==fingerprint||integrity.exists!==true)
    return {state:'unavailable',digestMatches:false,writerQuiescent:false};
   return {state:'present',digestMatches:integrity.digestVerified===true,
    writerQuiescent:false};
  }catch{
   return {state:'unavailable',digestMatches:false,writerQuiescent:false};
  }
 };
}
// No Storage read establishes that another writer has stopped. Always keep
// writerQuiescent false until a separate durable fence is proven.
