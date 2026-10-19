// XOXO Reveal BETA — server-only, create-only private object upload.
// REVIEW ONLY / NOT DEPLOYED. Must be called solely by an exclusive
// server coordinator after writer_begin_v2; never issue client upload tokens.
// upsert:false is defense-in-depth, NOT a durable Storage writer fence.
export function createRevealPrivateStorageCreateOnlyWriter({
 storageClient,maxBytes=15728640
}={}){
 if(typeof storageClient?.storage?.from!=='function'||
    !Number.isSafeInteger(maxBytes)||maxBytes<1)
  throw new TypeError('Trusted private Storage writer and byte limit required');
 return async function uploadPrivateObject({bucket,objectPath,bytes,contentType}={}){
  if(bucket!=='xoxo-reveal'||typeof objectPath!=='string'||!objectPath.trim()||
     objectPath.startsWith('/')||objectPath.includes('..')||
     objectPath.includes('\\')||objectPath.includes('?')||
     objectPath.includes('#')||
     objectPath.split('/').some(segment=>!segment||segment==='.'||segment==='..'))
   throw new TypeError('Invalid private Storage write locator');
  if(!(bytes instanceof Uint8Array)||bytes.byteLength<1||
     bytes.byteLength>maxBytes)
   throw new TypeError('Invalid private Storage upload bytes');
  if(!['image/jpeg','image/png','image/webp','video/mp4','video/webm'].includes(contentType))
   throw new TypeError('Unsupported private Storage media type');
  const {data,error}=await storageClient.storage.from('xoxo-reveal')
   .upload(objectPath,bytes,{contentType,upsert:false,cacheControl:'0'});
  if(error||!data)throw new Error('Private Storage create-only upload failed');
  return {objectPath,created:true};
 };
}
// RELEASE BLOCKER: service-role clients may still overwrite by other APIs.
// Enforce exclusive writer access and Storage permissions before deployment.

/**
 * Bind create-only uploads to a trusted server-only writer lease.
 * Authorization callback must check the durable attempt/token and writer
 * state. This preflight is not atomic with Storage; never expose raw client.
 */
export function createRevealWriterGatedPrivateStorageWriter({
 storageClient,authorizeActiveWriter,maxBytes
}={}){
 if(typeof authorizeActiveWriter!=='function')
  throw new TypeError('Trusted active writer authorization required');
 const effectiveMaxBytes=maxBytes===undefined?15728640:maxBytes;
 const createOnly=createRevealPrivateStorageCreateOnlyWriter({storageClient,maxBytes:effectiveMaxBytes});
 return async function writeWithLease({
  attemptId,senderId,writerToken,bucket,objectPath,bytes,contentType
 }={}){
  if([attemptId,senderId,writerToken].some(value=>typeof value!=='string'||!value.trim()))
   throw new TypeError('Missing trusted writer identity');
  // Validate Storage inputs before requesting a privileged writer grant.
  if(bucket!=='xoxo-reveal'||typeof objectPath!=='string'||!objectPath.trim()||
     objectPath.startsWith('/')||objectPath.includes('..')||
     objectPath.includes('\\')||objectPath.includes('?')||objectPath.includes('#')||
     objectPath.split('/').some(segment=>!segment||segment==='.'||segment==='..')||
     !(bytes instanceof Uint8Array)||bytes.byteLength<1||
     bytes.byteLength>effectiveMaxBytes||
     !['image/jpeg','image/png','image/webp','video/mp4','video/webm'].includes(contentType))
   throw new TypeError('Invalid private Storage write request');
  const authorized=await authorizeActiveWriter({attemptId,senderId,writerToken});
  if(authorized!==true)
   throw new Error('Active writer authorization denied');
  return createOnly({bucket,objectPath,bytes,contentType});
 };
}
