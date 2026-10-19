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
  let timer;
  let timedOut=false;
  const timeout=new Promise((_,reject)=>{
   timer=setTimeoutFn(()=>{
    timedOut=true;
    controller.abort();
    reject(new Error('Private Storage upload timed out; reconciliation required'));
   },timeoutMs);
  });
  try{
   const result=await Promise.race([
    Promise.resolve().then(()=>uploadPrivate({...input,signal:controller.signal})),
    timeout
   ]);
   if(timedOut)throw new Error('Private Storage upload timed out; reconciliation required');
   return result;
  }finally{clearTimeoutFn(timer);}
 };
}
// Never infer that timeout cancelled the Storage operation. Do not start
// replacement writes solely because this helper returned a timeout error.
