// XOXO Reveal BETA — isolated composition of post-upload evidence gate
// and server-only Supabase finalize RPC. REVIEW ONLY, NOT DEPLOYED.
// readTrustedEvidence must verify actual private Storage bytes/digest,
// authorized DM relationship and consistent attempt/recipient/quota binding.
import {createRevealPostUploadBindingGate} from './post-upload-binding-gate.mjs';
import {createRevealFinalizeSupabaseAdapter} from './finalize-supabase-adapter.mjs';
import {createRevealBindingEvidenceReader} from './binding-evidence-reader.mjs';
import {createRevealStorageIntegrityReader} from './storage-integrity-reader.mjs';
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

/**
 * Explicit trusted-reader composition for isolated integration tests.
 * A server must independently implement all five authoritative readers.
 * Do not accept evidence flags from an HTTP request.
 */
export function createRevealVerifiedFinalizeFromReaders({
 rpcClient,readAttempt,readRevealDm,readStorageIntegrity,readQuota,readWriter
}={}){
 const readTrustedEvidence=createRevealBindingEvidenceReader({
  readAttempt,readRevealDm,readStorageIntegrity,readQuota,readWriter
 });
 return createRevealVerifiedFinalizeService({rpcClient,readTrustedEvidence});
}

/**
 * Composes the real-byte integrity verifier with independently injected,
 * privileged database evidence readers. REVIEW ONLY / NOT DEPLOYED.
 * No public HTTP inputs may supply expectedSha256 or evidence flags.
 */
export function createRevealVerifiedFinalizeWithStorage({
 rpcClient,readAttempt,readRevealDm,readQuota,readWriter,
 resolveObjectBinding,readPrivateBytes,sha256
}={}){
 const readStorageIntegrity=createRevealStorageIntegrityReader({
  resolveObjectBinding,readPrivateBytes,sha256
 });
 return createRevealVerifiedFinalizeFromReaders({
  rpcClient,readAttempt,readRevealDm,readStorageIntegrity,readQuota,readWriter
 });
}
