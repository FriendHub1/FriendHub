// XOXO Reveal BETA — review-only server wiring. NOT DEPLOYED.
// Composes the real RPC-shaped adapters with the injected Storage coordinator.
// No service-role secrets or Storage clients are created in this module.
import {createRevealWriterClaimAdapter} from './writer-claim-supabase-adapter.mjs';
import {createRevealWriterVerificationAdapter} from './writer-verification-supabase-adapter.mjs';
import {executeFencedRevealStorageWrite} from './fenced-storage-write-coordinator.mjs';
export function createRevealFencedStorageService({
 rpcClient,uploadPrivateObject,markNeedsReconciliation
}={}){
 if(typeof uploadPrivateObject!=='function'||
    typeof markNeedsReconciliation!=='function')
  throw new TypeError('Trusted Storage and reconciliation adapters required');
 const claimRpc=createRevealWriterClaimAdapter({rpcClient});
 const verifyWriter=createRevealWriterVerificationAdapter({rpcClient});
 return async function sendStorage({
  attemptId,senderId,claimToken,writerToken,leaseSeconds=60
 }={}){
  if(!claimToken||!attemptId||!senderId||!writerToken)
   return {ok:false,reason:'invalid_writer_context'};
  return executeFencedRevealStorageWrite({
   attemptId,senderId,writerToken,
   claimWriter:()=>claimRpc({attemptId,senderId,claimToken,writerToken,leaseSeconds}),
   verifyWriter,
   uploadPrivateObject,
   markNeedsReconciliation
  });
 };
}
// A successful result is NOT permission to finalize, refund or publish a DM.
// SQL verification is a read, not a fence for an in-flight Storage write.
