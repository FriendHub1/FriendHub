import {RevealWriterBeginDeniedError} from './writer-begin-denied-error.mjs';
// XOXO Reveal BETA — fail-closed uncertain Storage outcome gate.
// REVIEW ONLY / NOT DEPLOYED. A timeout may leave the remote upload running.
// Persisting uncertainty in PostgreSQL is a separate required release step.
export function createRevealUploadUncertaintyGate({uploadAndSeal,markUncertain}={}){
 if(typeof uploadAndSeal!=='function'||typeof markUncertain!=='function')
  throw new TypeError('Trusted upload and reconciliation recorder required');
 const uncertain=new Set();
 const inFlight=new Set();
 return {
  async run(input={}){
   const {attemptId,senderId}=input;
   if(!attemptId||!senderId)throw new TypeError('Missing upload identity');
   if(typeof attemptId!=='string'||typeof senderId!=='string'||!attemptId.trim()||!senderId.trim())
    throw new TypeError('Invalid upload identity');
   const key=`${senderId}:${attemptId}`;
   if(uncertain.has(key))throw new Error('Upload requires reconciliation');
   if(inFlight.has(key))throw new Error('Upload already in flight');
   inFlight.add(key);
   try{
    return await uploadAndSeal(input);
   }catch(error){
    // A trusted coordinator can prove this denial occurred before Storage.
    // All other errors remain ambiguous and must be recorded as uncertain.
    if(error instanceof RevealWriterBeginDeniedError)throw error;
    // Once a remote write may have started, fail closed on every other error.
    uncertain.add(key);
    try{
     const recorded=await markUncertain({attemptId,senderId,reason:'upload_outcome_uncertain'});
     if(recorded!==true)throw new Error('Unconfirmed durable marker');
    }
    catch{
     throw new Error('Upload uncertain and reconciliation recording failed');
    }
    throw error;
   }finally{inFlight.delete(key);}
  },
  isUncertain({attemptId,senderId}={}){
   return uncertain.has(`${senderId}:${attemptId}`);
  }
 };
}
// A local Set cannot coordinate instances or survive restarts. The durable
// DB reconciliation marker and exclusive Storage writer route are mandatory.
