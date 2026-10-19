// XOXO Reveal BETA — read-only private Storage integrity verification.
// REVIEW ONLY / NOT DEPLOYED. Server-only trusted dependencies required.
// Payload fingerprint is NOT a file digest: compare SHA-256 to a separate
// server-owned expected object digest, never to browser-provided metadata.
export function createRevealStorageIntegrityReader({resolveObjectBinding,readPrivateBytes,sha256}={}){
 if([resolveObjectBinding,readPrivateBytes,sha256].some(fn=>typeof fn!=='function'))
  throw new TypeError('Trusted Storage integrity dependencies required');
 return async function readStorageIntegrity(input={}){
  if(input===null||typeof input!=='object'||Array.isArray(input))
   throw new TypeError('Invalid trusted Storage integrity context');
  const {attemptId,objectPath,payloadFingerprint}=input;
  if(typeof attemptId!=='string'||!attemptId.trim()||
     typeof objectPath!=='string'||!objectPath.trim()||
     !/^[a-f0-9]{64}$/.test(payloadFingerprint)||
     objectPath.startsWith('/')||objectPath.includes('..')||
     objectPath.includes('\\')||objectPath.includes('?')||objectPath.includes('#')||
     objectPath.split('/').some(segment=>!segment||segment==='.'||segment==='..'))
   throw new TypeError('Invalid trusted Storage integrity context');
  // The binding and expected digest must come from privileged server-owned DB rows.
  const binding=await resolveObjectBinding({attemptId});
  if(binding?.authoritative!==true||binding.attemptId!==attemptId||
     binding.bucket!=='xoxo-reveal'||binding.objectPath!==objectPath||
     binding.payloadFingerprint!==payloadFingerprint||
     !/^[a-f0-9]{64}$/.test(binding.expectedSha256||''))
   throw new Error('Trusted object binding unavailable');
  const bytes=await readPrivateBytes({bucket:'xoxo-reveal',objectPath});
  if(!(bytes instanceof Uint8Array)||bytes.byteLength===0)
   throw new Error('Private object bytes unavailable');
  const digest=await sha256(bytes);
  if(typeof digest!=='string'||!/^[a-f0-9]{64}$/.test(digest))
   throw new Error('Invalid trusted digest response');
  return {authoritative:true,objectPath,payloadFingerprint,
   exists:true,digestVerified:digest===binding.expectedSha256};
 };
}
// This reader cannot fence a concurrent Storage writer or establish a
// transactional snapshot with PostgreSQL. Never use alone to deploy finalize.
