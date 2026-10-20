// XOXO Reveal BETA — authenticated recipient-bound request adapter, REVIEW ONLY.
// Not a public endpoint. No direct Storage operations or production deployment.
import {authenticateRevealSender} from './authenticate.mjs';
import {inspectRevealUpload} from './upload-policy.mjs';
export function createRecipientBoundRequestAdapter({authClient,deliverReveal,digest=globalThis.crypto?.subtle}={}){
 if(typeof deliverReveal!=='function'||typeof digest?.digest!=='function')
  throw new TypeError('Trusted delivery and SHA-256 required');
 return async function processRecipientBoundRequest({
  authorization,recipientId,requestKey,bytes,claimedType,mode,seconds=null
 }={}){
  const {senderId}=await authenticateRevealSender({authorization,authClient});
  const meta=inspectRevealUpload({bytes,claimedType,senderId,recipientId,mode,seconds});
  if(!/^[A-Za-z0-9_-]{16,128}$/.test(requestKey||''))
   throw new TypeError('Invalid idempotency key');
  // Bind retries to the actual validated bytes, not a client-provided hash.
  // Copy bytes before asynchronous hashing so callers cannot mutate the buffer mid-digest.
  const verifiedBytes=new Uint8Array(bytes);
  const hash=await digest.digest('SHA-256',verifiedBytes);
  const payloadFingerprint=Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
  if(!/^[0-9a-f]{64}$/.test(payloadFingerprint))throw new Error('Invalid server digest');
  return deliverReveal({senderId,recipientId,requestKey,payloadFingerprint,
   bytes:verifiedBytes,mime:meta.mime,mediaType:meta.mediaType,mode:meta.mode,durationSeconds:meta.durationSeconds});
 };
}
