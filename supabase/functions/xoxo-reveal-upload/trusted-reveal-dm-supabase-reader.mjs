// XOXO Reveal BETA — privileged read-only Reveal/DM binding reader.
// REVIEW ONLY / NOT DEPLOYED. Authorization is asserted only by a trusted
// database-side checker, never inferred from a browser flag or these rows.
export function createRevealTrustedRevealDmReader({dbClient,verifyDmAuthorization}={}){
 if(typeof dbClient?.from!=='function'||typeof verifyDmAuthorization!=='function')
  throw new TypeError('Trusted DM database and authorization readers required');
 return async function readRevealDm(input={}){
  if(input===null||typeof input!=='object'||Array.isArray(input))
   throw new TypeError('Invalid Reveal DM input');
  const {attemptId,revealId,dmId}=input;
  if([attemptId,revealId,dmId].some(x=>typeof x!=='string'||!(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i).test(x)))
   throw new TypeError('Invalid Reveal DM identifiers');
  let reveal,revealError;
  try{
   ({data:reveal,error:revealError}=await dbClient.from('xoxo_reveals')
    .select('id,dm_id,upload_attempt_id,sender_id,recipient_id,object_path,payload_fingerprint')
    .eq('id',revealId).eq('dm_id',dmId).eq('upload_attempt_id',attemptId).maybeSingle());
  }catch{throw new Error('Trusted Reveal binding unavailable');}
  if(revealError||!reveal||typeof reveal!=='object'||Array.isArray(reveal)||reveal.id!==revealId||
     reveal.dm_id!==dmId||reveal.upload_attempt_id!==attemptId)
   throw new Error('Trusted Reveal binding unavailable');
  let dm,dmError;
  try{
   ({data:dm,error:dmError}=await dbClient.from('direct_messages')
    .select('id,sender_id,recipient_id').eq('id',dmId).maybeSingle());
  }catch{throw new Error('Trusted DM binding unavailable');}
  if(dmError||!dm||typeof dm!=='object'||Array.isArray(dm)||dm.id!==dmId||dm.sender_id!==reveal.sender_id||
     dm.recipient_id!==reveal.recipient_id||
     typeof reveal.sender_id!=='string'||!reveal.sender_id.trim()||
     typeof reveal.recipient_id!=='string'||!reveal.recipient_id.trim()||
     reveal.sender_id===reveal.recipient_id||
     typeof reveal.object_path!=='string'||!reveal.object_path.trim()||
     reveal.object_path.startsWith('/')||
     reveal.object_path.split('/').some(segment=>segment===''||segment==='.'||segment==='..')||
     typeof reveal.payload_fingerprint!=='string'||
     !/^[a-f0-9]{64}$/.test(reveal.payload_fingerprint))
   throw new Error('Trusted DM binding unavailable');
  // Recheck the exact persisted identities, not a caller-supplied DM pair.
  // The trusted authorizer must also enforce current blocks and membership.
  let authorized=false;
  try{
   authorized=await verifyDmAuthorization({
    senderId:reveal.sender_id,recipientId:reveal.recipient_id,dmId,attemptId
   });
  }catch{throw new Error('Trusted DM authorization unavailable');}
  if(authorized!==true)throw new Error('Trusted DM authorization unavailable');
  return {authoritative:true,attemptId,revealId,dmId,
   senderId:reveal.sender_id,objectPath:reveal.object_path,
   payloadFingerprint:reveal.payload_fingerprint,
   authorizedAtLink:true,recipientMatches:true};
 };
}
// Must use a server-side checker matching current DM/block policies.
// Independent reads do not establish a transactional snapshot.
