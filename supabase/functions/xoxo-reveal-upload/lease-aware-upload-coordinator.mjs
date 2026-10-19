// XOXO Reveal BETA — cooperative lease-aware upload coordinator.
// REVIEW ONLY / NOT DEPLOYED. No timers: the trusted upload implementation
// must call checkpoint() periodically, including after its final write.
// The coordinator refuses to seal after any failed renewal.
export function createRevealLeaseAwareUploadCoordinator({
 beginWriter,renewWriter,uploadPrivate,sealWriter
}={}){
 if([beginWriter,renewWriter,uploadPrivate,sealWriter].some(fn=>typeof fn!=='function'))
  throw new TypeError('Trusted lease lifecycle dependencies required');
 const active=new Set();
 return async function uploadAndSeal(input={}){
  if(input===null||typeof input!=='object'||Array.isArray(input))
   throw new TypeError('Valid upload input required');
  const {attemptId,senderId,writerToken}=input;
  if([attemptId,senderId,writerToken].some(value=>typeof value!=='string'||!value.trim()))
   throw new TypeError('Missing trusted writer identity');
  const identity={attemptId,senderId,writerToken};
  const key=JSON.stringify([senderId,attemptId]);
  if(active.has(key))throw new Error('Upload already in flight');
  active.add(key);
  let failed=false;
  let renewal=Promise.resolve();
  let checkpointCount=0;
  const checkpoint=()=>{
   checkpointCount++;
   // Serialize overlapping checkpoints; a failed renewal poisons the lease.
   const next=renewal.then(async()=>{
   if(failed)throw new Error('Writer lease already lost');
   let renewed=false;
   try{renewed=await renewWriter(identity);}catch{}
   if(renewed!==true){
    failed=true;
    throw new Error('Writer lease renewal failed');
   }
   return true;
   });
   renewal=next.catch(()=>{});
   return next;
  };
  try{
   if(await beginWriter(identity)!==true)throw new Error('Writer begin denied');
   await checkpoint();
   const uploaded=await uploadPrivate({...input,checkpoint});
   // A trusted uploader may schedule checkpoints without awaiting them.
   // Drain all outstanding renewals before accepting its result.
   // Keep draining if a trusted uploader scheduled another checkpoint
   // while the previous batch was still settling.
   let observed=-1;
   while(observed!==checkpointCount){
    observed=checkpointCount;
    await renewal;
   }
   if(failed)throw new Error('Writer lease already lost');
   if(uploaded?.created!==true)throw new Error('Private upload not confirmed');
   await checkpoint();
   if(failed)throw new Error('Writer lease already lost');
   if(await sealWriter(identity)!==true)
    throw new Error('Writer seal denied; reconcile upload');
   return {created:true,sealed:true,objectPath:uploaded.objectPath};
  }finally{active.delete(key);}
 };
}
// This cooperative checkpoint cannot guarantee renewal while an uninterruptible
// Storage request is in flight. Use bounded request timeouts, exclusive writer
// routing, durable fencing and reconciliation before production deployment.
