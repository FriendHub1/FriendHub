// XOXO Reveal BETA — privileged DB reader for the durable upload preflight.
// REVIEW ONLY / NOT DEPLOYED. Never accept attempt state from a client.
export function createRevealDurableUncertaintySupabaseReader({dbClient}={}){
 if(typeof dbClient?.from!=='function')
  throw new TypeError('Privileged Supabase database client required');
 return async function readAttempt({attemptId,senderId}={}){
  if([attemptId,senderId].some(v=>typeof v!=='string'||!v.trim()))
   throw new TypeError('Valid attempt identity required');
  let response;
  try{
   response=await dbClient.from('xoxo_reveal_upload_attempts')
    .select('id,sender_id,status,upload_uncertain_at')
    .eq('id',attemptId).eq('sender_id',senderId).maybeSingle();
  }catch{throw new Error('Durable attempt state unavailable');}
  if(response?.error)throw new Error('Durable attempt state unavailable');
  const row=response?.data;
  if(row==null)return null;
  if(row.id!==attemptId||row.sender_id!==senderId||
     typeof row.status!=='string'||!Object.hasOwn(row,'upload_uncertain_at'))
   throw new Error('Durable attempt state unavailable');
  return row;
 };
}
