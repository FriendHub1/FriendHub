// XOXO Reveal BETA — compose trusted evidence gate and finalize v2 RPC.
// REVIEW ONLY / NOT DEPLOYED. This creates no DM and does not read Storage.
// readTrustedEvidence must verify actual bytes/digest, immutable DB links,
// authorization, quota and writer state using privileged server-only sources.
import {createRevealPostUploadBindingGate} from './post-upload-binding-gate.mjs';
import {createRevealFinalizeSupabaseAdapter} from './finalize-supabase-adapter.mjs';
export function createRevealVerifiedFinalizationService({
 rpcClient,readTrustedEvidence
}={}){
 const finalizeAttempt=createRevealFinalizeSupabaseAdapter({rpcClient});
 return createRevealPostUploadBindingGate({
  readTrustedEvidence,finalizeAttempt
 });
}
// Never expose the service-role RPC client or claim token to a browser.
// Finalize RPC alone cannot atomically fence an in-flight Storage write.
