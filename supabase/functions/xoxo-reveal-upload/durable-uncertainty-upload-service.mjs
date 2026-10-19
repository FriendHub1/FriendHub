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
 const preflightInFlight=new Set();
 const completed=new Set();
 // Check local state first. An uncertain attempt must remain blocked even
 // when the DB preflight becomes temporarily unavailable.
 return {
  async run(input={}){
   if(input===null||typeof input!=='object'||Array.isArray(input))
    throw new TypeError('Valid upload input required');
   const {attemptId,senderId}=input;
   if([attemptId,senderId].some(v=>typeof v!=='string'||!v.trim()))
    throw new TypeError('Valid attempt identity required');
   if(localGate.isUncertain(input))
    throw new Error('Upload requires reconciliation');
   const key=JSON.stringify([senderId,attemptId]);
   if(completed.has(key))throw new Error('Upload already completed');
   if(preflightInFlight.has(key))throw new Error('Upload already in flight');
   preflightInFlight.add(key);
   try{
    const result=await preflight(input);
    // Even if a replica has not observed the DB commit, this instance must
    // never repeat a successful upload for the same attempt.
    completed.add(key);
    return result;
   }
   finally{preflightInFlight.delete(key);}
  },
  isUncertain:localGate.isUncertain
 };
}
// A read before a write is not a transaction or cross-instance mutex.
// No live Storage write is authorized by this composition alone.
