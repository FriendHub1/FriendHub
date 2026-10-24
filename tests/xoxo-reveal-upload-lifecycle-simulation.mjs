// XOXO Reveal BETA — isolated upload lifecycle simulation.
// NO network, DB, Storage or production writes. Simulates durable claim,
// upload, finalize and ambiguous outcomes for security review.
import {decideRevealUploadRetry} from "../supabase/functions/xoxo-reveal-upload/durable-retry-policy.mjs";
import {assessRevealUploadFinalization} from "../supabase/functions/xoxo-reveal-upload/finalize-policy.mjs";

export function createRevealLifecycleSimulation(){
 const attempts=new Map(),objects=new Map(),messages=new Map();
 const counters={claims:0,uploads:0,links:0,finalizations:0};
 const keyOf=(sender,key)=>sender+":"+key;
 async function send({senderId,requestKey,fingerprint,recipientId,interruptAt}){
  if(!senderId||!recipientId||!requestKey)throw new Error("Missing identity or request key");
  const scope=keyOf(senderId,requestKey);
  let attempt=attempts.get(scope);
  const decision=decideRevealUploadRetry({attempt,fingerprint});
  if(decision.action==="return_existing")return {status:"completed",revealId:decision.revealId,dmId:decision.dmId};
  if(decision.action==="reject")return {status:"rejected"};
  if(decision.action==="wait")return {status:"pending"};
  if(decision.action==="manual_reconciliation")return {status:"needs_reconciliation"};
  if(decision.action!=="claim_new")throw new Error("Unexpected claim decision");
  const claimToken="server-owner-"+(counters.claims+1);
  attempt={sender_id:senderId,request_key:requestKey,payload_fingerprint:fingerprint,
    claim_token:claimToken,status:"pending"};
  attempts.set(scope,attempt);counters.claims++;
  if(interruptAt==="after_claim")return {status:"interrupted"};
  const path="private/mock-"+counters.claims+".webp";
  objects.set(path,{recipientId});counters.uploads++;
  if(interruptAt==="after_upload")return {status:"interrupted"};
  const revealId="reveal-"+counters.claims,dmId="dm-"+counters.claims;
  const linkedReveal={id:revealId,dm_id:dmId,sender_id:senderId,
    dm_sender_id:senderId,recipient_id:recipientId,dm_recipient_id:recipientId};
  messages.set(revealId,linkedReveal);counters.links++;
  if(interruptAt==="after_link")return {status:"interrupted"};
  const final=assessRevealUploadFinalization({attempt,senderId,claimToken,
    revealId,dmId,linkedReveal});
  if(!final.allowed)throw new Error("Finalize denied: "+final.reason);
  Object.assign(attempt,{status:"completed",reveal_id:revealId,dm_id:dmId});
  counters.finalizations++;
  if(interruptAt==="after_finalize")return {status:"interrupted"};
  return {status:"completed",revealId,dmId};
 }
 return {send,attempts,objects,messages,counters};
}
// Interruptions intentionally leave pending attempts; a second request must
// NOT repeat Storage writes until a trusted reconciliation process determines
// whether the original operation committed. This is a simulation only.
