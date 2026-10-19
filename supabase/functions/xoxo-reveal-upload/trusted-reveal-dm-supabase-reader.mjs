// XOXO Reveal BETA — privileged read-only Reveal/DM binding reader.
// REVIEW ONLY / NOT DEPLOYED. Authorization is asserted only by a trusted
// database-side checker, never inferred from a browser flag or these rows.
export function createRevealTrustedRevealDmReader({dbClient,verifyDmAuthorization}={}){
 if(typeof dbClient?.from!=='function'||typeof verifyDmAuthorization!=='function')
  throw new TypeError('Trusted DM database and authorization readers required');
 return async function readRevealDm({attemptId,revealId,dmId}={}){
  if([attemptId,revealId,dmId].some(x=>typeof x!=='string'||!x))
   throw new TypeError('Invalid Reveal DM identifiers');
  const {data:reveal,error:revealError}=await dbClient.from('xoxo_reveals')
   .select('id,dm_id,upload_attempt_id,sender_id,recipient_id,object_path,payload_fingerprint')
   .eq('id',revealId).eq('dm_id',dmId).eq('upload_attempt_id',attemptId).maybeSingle();
  if(revealError||!reveal||reveal.id!==revealId||
     reveal.dm_id!==dmId||reveal.upload_attempt_id!==attemptId)
   throw new Error('Trusted Reveal binding unavailable');
  const {data:dm,error:dmError}=await dbClient.from('direct_messages')
   .select('id,sender_id,recipient_id').eq('id',dmId).maybeSingle();
  if(dmError||!dm||dm.id!==dmId||dm.sender_id!==reveal.sender_id||
     dm.recipient_id!==reveal.recipient_id||
     !reveal.sender_id||!reveal.recipient_id||
     reveal.sender_id===reveal.recipient_id||
     !reveal.object_path||!/^[a-f0-9]{64}$/.test(reveal.payload_fingerprint||''))
   throw new Error('Trusted DM binding unavailable');
  const authorized=await verifyDmAuthorization({
   senderId:reveal.sender_id,recipientId:reveal.recipient_id,dmId,attemptId
  });
  if(authorized!==true)throw new Error('Trusted DM authorization unavailable');
  return {authoritative:true,attemptId,revealId,dmId,
   senderId:reveal.sender_id,objectPath:reveal.object_path,
   payloadFingerprint:reveal.payload_fingerprint,
   authorizedAtLink:true,recipientMatches:true};
 };
}
// Must use a server-side checker matching current DM/block policies.
// Independent reads do not establish a transactional snapshot.
