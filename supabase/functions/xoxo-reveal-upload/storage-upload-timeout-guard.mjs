// XOXO Reveal BETA — bounded private Storage upload helper.
// REVIEW ONLY / NOT DEPLOYED. Timeout is advisory: it does NOT cancel
// an external Storage request unless the underlying client honors AbortSignal.
// On timeout the writer must remain unreconciled, never sealed or reassigned.
export function createRevealStorageUploadTimeoutGuard({
 uploadPrivate,timeoutMs=30000,setTimeoutFn=setTimeout,clearTimeoutFn=clearTimeout
}={}){
 if(typeof uploadPrivate!=='function'||!Number.isSafeInteger(timeoutMs)||
  timeoutMs<1000||timeoutMs>120000)
  throw new TypeError('Valid bounded upload and timeout required');
 return async function boundedUpload(input={}){
  const controller=new AbortController();
  // Caller cancellation is advisory too; never interpret it as proof that
  // the remote Storage operation has stopped.
  const externalSignal=input?.signal;
  if(externalSignal?.aborted)
   throw new Error('Private Storage upload aborted; reconciliation required');
  let timer;
  let timedOut=false;
  let callerAborted=false;
  const onAbort=()=>{
   callerAborted=true;
   controller.abort();
  };
  externalSignal?.addEventListener?.('abort',onAbort,{once:true});
  // Close the race between the initial aborted check and registration.
  if(externalSignal?.aborted)onAbort();
  const timeout=new Promise((_,reject)=>{
   timer=setTimeoutFn(()=>{
    timedOut=true;
    controller.abort();
    reject(new Error('Private Storage upload timed out; reconciliation required'));
   },timeoutMs);
  });
  try{
   if(callerAborted)
    throw new Error('Private Storage upload aborted; reconciliation required');
   const result=await Promise.race([
    Promise.resolve().then(()=>uploadPrivate({...input,signal:controller.signal})),
    timeout
   ]);
   if(timedOut)throw new Error('Private Storage upload timed out; reconciliation required');
   if(callerAborted||externalSignal?.aborted)
    throw new Error('Private Storage upload aborted; reconciliation required');
   return result;
  }finally{
   clearTimeoutFn(timer);
   externalSignal?.removeEventListener?.('abort',onAbort);
  }
 };
}
// Never infer that timeout cancelled the Storage operation. Do not start
// replacement writes solely because this helper returned a timeout error.
