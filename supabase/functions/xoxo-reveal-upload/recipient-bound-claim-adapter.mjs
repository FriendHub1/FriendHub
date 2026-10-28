// XOXO Reveal BETA — server-only idempotent upload claim adapter.
// REVIEW ONLY: do not expose the privileged RPC client to the browser.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FINGERPRINT=/^[0-9a-f]{64}$/;
const KEY=/^[A-Za-z0-9_-]{16,128}$/;
const ACTIONS=new Set(['claimed','wait','reject','return_existing','manual_reconciliation']);
export function createRecipientBoundClaimAdapter({rpcClient}={}){
 if(typeof rpcClient?.rpc!=='function')throw new TypeError('Trusted RPC client required');
 return async function claimUpload({senderId,recipientId,requestKey,payloadFingerprint}={}){
  if(!UUID.test(senderId||'')||!UUID.test(recipientId||'')||senderId===recipientId
    ||!KEY.test(requestKey||'')||!FINGERPRINT.test(payloadFingerprint||''))
   throw new TypeError('Invalid trusted upload claim');
  let response;
  try{
   response=await rpcClient.rpc('xoxo_reveal_claim_upload_v2',{
    p_sender_id:senderId,p_recipient_id:recipientId,
    p_request_key:requestKey,p_payload_fingerprint:payloadFingerprint
   });
  }catch{throw new Error('Upload claim unavailable');}
  if(response?.error)throw new Error('Upload claim unavailable');
  const row=Array.isArray(response?.data)?response.data[0]:response?.data;
  if(!row||!ACTIONS.has(row.action)||!UUID.test(row.attempt_id||''))
   throw new Error('Invalid upload claim response');
  if(row.action==='claimed'&&!UUID.test(row.owner_token||''))
   throw new Error('Missing private claim ownership');
  if(row.action==='return_existing'&&(!UUID.test(row.reveal_id||'')||!UUID.test(row.dm_id||'')))
   throw new Error('Invalid completed claim');
  return {action:row.action,attemptId:row.attempt_id,
   ...(row.action==='claimed'?{ownerToken:row.owner_token}:{}),
   ...(row.action==='return_existing'?{revealId:row.reveal_id,dmId:row.dm_id}:{})};
 };
}
