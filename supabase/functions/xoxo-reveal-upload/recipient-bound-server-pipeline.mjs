// XOXO Reveal BETA — server-only composition, REVIEW ONLY, NOT DEPLOYED.
// This does not implement Storage or grant an endpoint permission to upload.
// Only inject a prepareSealedUpload implementation after its writer-lease,
// quota, private-object and uncertain-write safety have been reviewed.
import {createRecipientBoundRequestAdapter} from './recipient-bound-request-adapter.mjs';
import {createRecipientBoundClaimAdapter} from './recipient-bound-claim-adapter.mjs';
import {createRecipientBoundDeliveryCoordinator} from './recipient-bound-delivery-coordinator.mjs';
import {createTransactionalLinkedMessageAdapter} from './transactional-linked-message-adapter.mjs';

export function createRecipientBoundServerPipeline({
 authClient,rpcClient,prepareSealedUpload,digest
}={}){
 if(typeof prepareSealedUpload!=='function')
  throw new TypeError('Trusted sealed-upload implementation required');
 const claimUpload=createRecipientBoundClaimAdapter({rpcClient});
 const createLinkedMessage=createTransactionalLinkedMessageAdapter({rpcClient});
 const deliverReveal=createRecipientBoundDeliveryCoordinator({
  claimUpload,prepareSealedUpload,createLinkedMessage
 });
 return createRecipientBoundRequestAdapter({authClient,deliverReveal,digest});
}
