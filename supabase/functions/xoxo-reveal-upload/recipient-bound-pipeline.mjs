// XOXO Reveal BETA — composition of trusted adapters, REVIEW ONLY / NOT DEPLOYED.
// This is NOT an HTTP endpoint. Caller must inject a server-only privileged RPC
// client and a real, independently reviewed sealed Storage writer.
import {createRecipientBoundRequestAdapter} from './recipient-bound-request-adapter.mjs';
import {createRecipientBoundClaimAdapter} from './recipient-bound-claim-adapter.mjs';
import {createRecipientBoundDeliveryCoordinator} from './recipient-bound-delivery-coordinator.mjs';
import {createAtomicRevealMessageAdapter} from './transactional-linked-message-adapter.mjs';

export function createRecipientBoundPipeline({authClient,rpcClient,prepareSealedUpload,digest}={}){
 if(typeof prepareSealedUpload!=='function')
  throw new TypeError('Trusted sealed Storage writer required');
 const claimUpload=createRecipientBoundClaimAdapter({rpcClient});
 const createLinkedMessage=createAtomicRevealMessageAdapter({rpcClient});
 const deliverReveal=createRecipientBoundDeliveryCoordinator({
  claimUpload,prepareSealedUpload,createLinkedMessage
 });
 return createRecipientBoundRequestAdapter({
  authClient,deliverReveal,...(digest?{digest}:{})
 });
}
// RELEASE BLOCKERS: writer lifecycle, Storage in-flight race protection,
// recipient authorization, quota reservation, private bucket setup,
// migrations and end-to-end integration review before exposing an endpoint.
