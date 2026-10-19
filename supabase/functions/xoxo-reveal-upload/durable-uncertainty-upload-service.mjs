// XOXO Reveal BETA — trusted composition for persistent uncertainty checks.
// REVIEW ONLY / NOT DEPLOYED. The supplied uploadAndSeal must itself enforce
// an atomic writer claim, exclusive Storage routing and durable fencing.
import {createRevealDurableUncertaintyPreflight} from './durable-uncertainty-preflight.mjs';
import {createRevealDurableUncertaintySupabaseReader} from './durable-uncertainty-supabase-reader.mjs';
import {createRevealUploadUncertaintyGate} from './upload-uncertainty-gate.mjs';
import {createRevealUploadUncertaintyRpcMarker} from './upload-uncertainty-rpc-adapter.mjs';

export function createRevealDurableUncertaintyUploadService({
 dbClient,rpcClient,uploadAndSeal
}={}){
 if(typeof uploadAndSeal!=='function')
  throw new TypeError('Trusted writer-fenced upload required');
 const readAttempt=createRevealDurableUncertaintySupabaseReader({dbClient});
 const markUncertain=createRevealUploadUncertaintyRpcMarker({rpcClient});
 // The persisted read is outside the local uncertainty gate, so a restart
 // cannot bypass an earlier attempt's durable uncertain marker.
 const localGate=createRevealUploadUncertaintyGate({
  uploadAndSeal,markUncertain
 });
 // Denied preflights never began a remote write: do not falsely mark them
 // uncertain. Only failures after entering the local gate need a marker.
 const preflight=createRevealDurableUncertaintyPreflight({
  readAttempt,uploadAndSeal:localGate.run
 });
 // Check local state first. An uncertain attempt must remain blocked even
 // when the DB preflight becomes temporarily unavailable.
 return {
  async run(input={}){
   if(localGate.isUncertain(input))
    throw new Error('Upload requires reconciliation');
   return preflight(input);
  },
  isUncertain:localGate.isUncertain
 };
}
// A read before a write is not a transaction or cross-instance mutex.
// No live Storage write is authorized by this composition alone.
