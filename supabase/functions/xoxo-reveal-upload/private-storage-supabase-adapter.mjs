// XOXO Reveal BETA — private Storage adapter, REVIEW ONLY / NOT DEPLOYED.
// A trusted server must authorize the sender, object path, MIME and bytes first.
// Never accept a user-provided bucket or service-role credential.
import {MAX_IMAGE_BYTES,MAX_VIDEO_BYTES} from './upload-policy.mjs';
export function createRevealPrivateStorageAdapter({
 storageClient,bucket='xoxo-reveal'
}={}){
 if(!storageClient?.storage?.from||bucket!=='xoxo-reveal')
  throw new TypeError('Trusted private Storage client required');
 return async function uploadPrivateObject({
 attemptId,senderId,writerToken,objectPath,bytes,contentType
 }={}){
  if(!attemptId||!senderId||!writerToken||
     typeof objectPath!=='string'||!objectPath||
     !(bytes instanceof Uint8Array)||bytes.byteLength<1||
     !['image/webp','video/mp4','video/webm'].includes(contentType))
   throw new TypeError('Invalid trusted Storage upload inputs');
  const maxBytes=contentType==='image/webp'?MAX_IMAGE_BYTES:MAX_VIDEO_BYTES;
  if(bytes.byteLength>maxBytes)throw new TypeError('Private Storage size limit exceeded');
  // No upsert: never overwrite a private object during a retry.
  const {data,error}=await storageClient.storage.from(bucket).upload(
   objectPath,bytes,{contentType,upsert:false}
  );
  if(error||!data||typeof data.path!=='string'||
     data.path!==objectPath)
   throw new Error('Private Storage upload not acknowledged');
  return {stored:true};
 };
}
// No signed URL, public URL, deletion, automatic retry or quota refund.
// Path uniqueness and attempt association must be enforced by the DB layer.
