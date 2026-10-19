// XOXO Reveal BETA — isolated composition of preflight and fenced Storage.
// NOT DEPLOYED. Trusted adapters must enforce JWT sender, DM/block rules,
// immutable attempt-owned object paths and real Storage write fencing.
import {createPreflightedRevealStorageService} from './preflighted-storage-service.mjs';
import {createRevealFencedStorageService} from './fenced-storage-supabase-service.mjs';
export function createRevealValidatedUploadPipeline({
 rpcClient,storageClient,authorizeDm,resolveServerObjectPath,
 markNeedsReconciliation
}={}){
 const sendStorage=createRevealFencedStorageService({
  rpcClient,storageClient,markNeedsReconciliation
 });
 return createPreflightedRevealStorageService({
  sendStorage,authorizeDm,resolveServerObjectPath
 });
}
// No user-facing endpoint or DM creation. No real database migrations applied.
