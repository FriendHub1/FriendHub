// XOXO Reveal BETA — server-only private object binding evidence.
// REVIEW ONLY / NOT DEPLOYED. Requires an independently persisted digest
// in a trusted table, not a fingerprint or a browser-supplied hash.
export function createRevealTrustedObjectBindingReader({dbClient}={}){
 if(typeof dbClient?.from!=='function')
  throw new TypeError('Trusted object binding database client required');
 return async function resolveObjectBinding({attemptId}={}){
  if(typeof attemptId!=='string'||!attemptId.trim())
   throw new TypeError('Invalid object binding attempt');
  const {data,error}=await dbClient.from('xoxo_reveal_upload_objects')
   .select('attempt_id,sender_id,bucket_id,object_path,payload_fingerprint,expected_sha256')
   .eq('attempt_id',attemptId).maybeSingle();
  if(error||!data||data.attempt_id!==attemptId||
     !data.sender_id||data.bucket_id!=='xoxo-reveal'||
     typeof data.object_path!=='string'||!data.object_path||
     data.object_path.startsWith('/')||data.object_path.includes('..')||
     data.object_path.includes('\\')||data.object_path.includes('?')||
     data.object_path.includes('#')||
     !/^[a-f0-9]{64}$/.test(data.payload_fingerprint||'')||
     !/^[a-f0-9]{64}$/.test(data.expected_sha256||''))
   throw new Error('Trusted object binding unavailable');
  return {authoritative:true,attemptId,bucket:data.bucket_id,
   objectPath:data.object_path,payloadFingerprint:data.payload_fingerprint,
   expectedSha256:data.expected_sha256};
 };
}
// Database evidence is not a Storage writer fence or transactional snapshot.
