// XOXO Reveal BETA — atomic DM + Reveal creation adapter, REVIEW ONLY / NOT DEPLOYED.
// This deliberately calls one PostgreSQL RPC. Do not replace with separate
// direct_messages and xoxo_reveals inserts: partial delivery must be impossible.
// The RPC must be implemented/reviewed and granted only to the trusted server role
// before this adapter can be wired into an Edge Function.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MODES=new Set(["once","timed","keep"]);
export function createAtomicRevealMessageAdapter({rpcClient}={}){
 if(typeof rpcClient?.rpc!=="function")throw new TypeError("Trusted transactional RPC client required");
 return async function createLinkedRevealMessage(input={}){
  if(input===null||typeof input!=="object"||Array.isArray(input))throw new TypeError("Invalid linked message input");
  const {attemptId,claimToken,senderId,recipientId,objectPath,mediaType,mode,seconds,durationSeconds}=input;
  if(!UUID.test(attemptId||'')||!UUID.test(claimToken||''))throw new TypeError('Missing trusted attempt claim');
  if(!UUID.test(senderId||"")||!UUID.test(recipientId||"")||senderId===recipientId)
   throw new TypeError("Invalid trusted participant IDs");
  if(typeof objectPath!=="string"||!objectPath.trim()||objectPath.startsWith("/")||
    objectPath.includes("..")||objectPath.includes("\\\\")||objectPath.includes("?")||
    objectPath.includes("#")||objectPath.split("/").some(x=>!x||x==="."||x===".."))
   throw new TypeError("Invalid private object path");
  if(!["image","video"].includes(mediaType)||!MODES.has(mode))
   throw new TypeError("Invalid Reveal metadata");
  if(mode==="timed"&&(![5,10,15,20].includes(seconds)||durationSeconds!==seconds))
   throw new TypeError("Invalid timed Reveal duration");
  if(mode!=="timed"&&(seconds!==null&&seconds!==undefined||durationSeconds!==null&&durationSeconds!==undefined))
   throw new TypeError("Unexpected Reveal duration");
  let response;
  try{
   response=await rpcClient.rpc("xoxo_reveal_create_linked_dm_v1",{
    p_attempt_id:attemptId,p_claim_token:claimToken,
    p_sender_id:senderId,p_recipient_id:recipientId,p_object_path:objectPath,
    p_media_type:mediaType,p_mode:mode,p_duration_seconds:mode==="timed"?seconds:null
   });
  }catch{throw new Error("Atomic Reveal message creation unavailable");}
  if(response?.error)throw new Error("Atomic Reveal message creation unavailable");
  const row=Array.isArray(response?.data)?response.data[0]:response?.data;
  if(!row||!UUID.test(row.reveal_id||"")||!UUID.test(row.dm_id||""))
   throw new Error("Atomic Reveal message creation returned invalid identifiers");
  return {revealId:row.reveal_id,dmId:row.dm_id};
 };
}
// RELEASE BLOCKER: xoxo_reveal_create_linked_dm_v1 must be created and reviewed
// as a single transaction that rechecks DM eligibility, blocks, sender identity,
// private bucket/path ownership and inserts both linked rows atomically.
