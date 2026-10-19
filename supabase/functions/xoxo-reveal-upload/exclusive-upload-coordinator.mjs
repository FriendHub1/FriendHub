// XOXO Reveal BETA — single-process exclusive upload coordinator.
// REVIEW ONLY / NOT DEPLOYED. Local in-flight tracking is not distributed:
// deploy only with a durable cross-instance lease and exclusive Storage writes.
export function createRevealExclusiveUploadCoordinator({
 beginWriter,uploadPrivate,sealWriter
}={}){
 if([beginWriter,uploadPrivate,sealWriter].some(fn=>typeof fn!=='function'))
  throw new TypeError('Trusted writer lifecycle dependencies required');
 const active=new Set();
 return async function uploadAndSeal(input={}){
  const {attemptId,senderId,writerToken}=input;
  if(!attemptId||!senderId||!writerToken)
   throw new TypeError('Missing trusted writer identity');
  const key=`${senderId}:${attemptId}`;
  if(active.has(key))throw new Error('Upload already in flight');
  active.add(key);
  try{
   const begun=await beginWriter({attemptId,senderId,writerToken});
   if(begun!==true)throw new Error('Writer begin denied');
   const uploaded=await uploadPrivate(input);
   if(uploaded?.created!==true)
    throw new Error('Private upload not confirmed');
   const sealed=await sealWriter({attemptId,senderId,writerToken});
   if(sealed!==true)throw new Error('Writer seal denied; reconcile upload');
   return {created:true,sealed:true,objectPath:uploaded.objectPath};
  }finally{
   active.delete(key);
  }
 };
}
// A failed upload intentionally leaves writer_state='writing' for manual or
// server reconciliation; never seal on error or blindly retry a partial write.
