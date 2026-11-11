// XOXO Reveal BETA — server-side media preflight before writer claim.
// REVIEW ONLY, NOT DEPLOYED. This is not authentication, malware scanning,
// video duration validation, DM authorization or a Storage writer fence.
import {inspectRevealUpload} from './upload-policy.mjs';
export function createPreflightedRevealStorageService({
 sendStorage,authorizeDm,resolveServerObjectPath
}={}){
 if([sendStorage,authorizeDm,resolveServerObjectPath].some(fn=>typeof fn!=='function'))
  throw new TypeError('Trusted server preflight dependencies required');
 return async function sendValidated({
  attemptId,senderId,recipientId,claimToken,writerToken,
  bytes,contentType,mode,seconds,leaseSeconds=60
 }={}){
  if(!attemptId||!senderId||!recipientId||!claimToken||!writerToken)
   return {ok:false,reason:'invalid_server_context'};
  let media;
  try{media=inspectRevealUpload({bytes,claimedType:contentType,recipientId,senderId,mode,seconds});}
  catch{return {ok:false,reason:'invalid_media'};}
  let allowed=false;
  try{allowed=await authorizeDm({senderId,recipientId,attemptId});}
  catch{return {ok:false,reason:'dm_authorization_uncertain'};}
  if(allowed!==true)return {ok:false,reason:'dm_not_authorized'};
  let objectPath;
  try{objectPath=await resolveServerObjectPath({attemptId,senderId,recipientId,media});}
  catch{return {ok:false,reason:'object_path_uncertain'};}
  if(typeof objectPath!=='string'||!objectPath||
     objectPath.startsWith('/')||objectPath.includes('..')||
     objectPath.includes('\\')||objectPath.includes('?')||
     objectPath.includes('#'))
   return {ok:false,reason:'invalid_server_object_path'};
  return sendStorage({
   attemptId,senderId,claimToken,writerToken,leaseSeconds,
   objectPath,bytes,contentType:media.mime
  });
 };
}
// DM and block authorization MUST be revalidated atomically when linking DM.
// Never take objectPath or sender identity from an untrusted browser request.
