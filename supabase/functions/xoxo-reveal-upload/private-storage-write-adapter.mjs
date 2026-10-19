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
  if(bucket!=='xoxo-reveal'||typeof objectPath!=='string'||!objectPath||
     objectPath.startsWith('/')||objectPath.includes('..')||
     objectPath.includes('\\')||objectPath.includes('?')||
     objectPath.includes('#'))
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
