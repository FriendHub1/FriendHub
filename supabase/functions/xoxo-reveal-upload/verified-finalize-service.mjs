// XOXO Reveal BETA — isolated composition of post-upload evidence gate
// and server-only Supabase finalize RPC. REVIEW ONLY, NOT DEPLOYED.
// readTrustedEvidence must verify actual private Storage bytes/digest,
// authorized DM relationship and consistent attempt/recipient/quota binding.
import {createRevealPostUploadBindingGate} from './post-upload-binding-gate.mjs';
import {createRevealFinalizeSupabaseAdapter} from './finalize-supabase-adapter.mjs';
export function createRevealVerifiedFinalizeService({
 rpcClient,readTrustedEvidence
}={}){
 const finalizeAttempt=createRevealFinalizeSupabaseAdapter({rpcClient});
 return createRevealPostUploadBindingGate({
  readTrustedEvidence,finalizeAttempt
 });
}
// This composition does not itself implement evidence reads, Storage fencing,
// transactional DM insertion or moderation. Never deploy as a public endpoint.
