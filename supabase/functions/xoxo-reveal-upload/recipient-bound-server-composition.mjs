// XOXO Reveal BETA — private server composition, REVIEW ONLY / NOT DEPLOYED.
// No Storage writer is provided here: a reviewed, lease-safe prepareSealedUpload
// must be supplied by the trusted server before this can become an Edge endpoint.
import {createRecipientBoundClaimAdapter} from './recipient-bound-claim-adapter.mjs';
import {createAtomicRevealMessageAdapter} from './transactional-linked-message-adapter.mjs';
import {createRecipientBoundDeliveryCoordinator} from './recipient-bound-delivery-coordinator.mjs';
import {createRecipientBoundRequestAdapter} from './recipient-bound-request-adapter.mjs';

export function createRecipientBoundServerPipeline({authClient,rpcClient,prepareSealedUpload,digest}={}){
 if(typeof authClient?.auth?.getUser!=='function'||typeof rpcClient?.rpc!=='function'||
    typeof prepareSealedUpload!=='function')
  throw new TypeError('Trusted Auth, RPC and sealed Storage writer required');
 const deliverReveal=createRecipientBoundDeliveryCoordinator({
  claimUpload:createRecipientBoundClaimAdapter({rpcClient}),
  prepareSealedUpload,
  createLinkedMessage:createAtomicRevealMessageAdapter({rpcClient})
 });
 return createRecipientBoundRequestAdapter({authClient,deliverReveal,digest});
}
