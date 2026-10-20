// XOXO Reveal BETA — trusted composition root, REVIEW ONLY; never expose as a public endpoint.
// A production handler must supply server-only clients and a rigorously verified
// prepareSealedUpload implementation. This module does not write Storage itself.
import {createRecipientBoundClaimAdapter} from './recipient-bound-claim-adapter.mjs';
import {createRecipientBoundDeliveryCoordinator} from './recipient-bound-delivery-coordinator.mjs';
import {createRecipientBoundRequestAdapter} from './recipient-bound-request-adapter.mjs';
import {createTransactionalLinkedMessageAdapter} from './transactional-linked-message-adapter.mjs';

export function createRecipientBoundRevealService({
 authClient,rpcClient,prepareSealedUpload,digest
}={}){
 if(typeof prepareSealedUpload!=='function')throw new TypeError('Trusted sealed upload required');
 const claimUpload=createRecipientBoundClaimAdapter({rpcClient});
 const createLinkedMessage=createTransactionalLinkedMessageAdapter({rpcClient});
 const deliverReveal=createRecipientBoundDeliveryCoordinator({
  claimUpload,prepareSealedUpload,createLinkedMessage
 });
 return createRecipientBoundRequestAdapter({authClient,deliverReveal,digest});
}
