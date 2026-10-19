// XOXO Reveal BETA — server-only private Storage byte reader.
// REVIEW ONLY / NOT DEPLOYED. No signed or public URLs are created.
// Caller must first verify a server-owned immutable object binding.
export function createRevealPrivateStorageByteReader({
 storageClient,maxBytes=20*1024*1024
}={}){
 if(typeof storageClient?.storage?.from!=='function'||
    !Number.isSafeInteger(maxBytes)||maxBytes<1)
  throw new TypeError('Trusted private Storage client and byte limit required');
 return async function readPrivateBytes({bucket,objectPath}={}){
  if(bucket!=='xoxo-reveal'||typeof objectPath!=='string'||
     !objectPath.trim()||objectPath.startsWith('/')||
     objectPath.includes('..')||objectPath.includes('\\')||
     objectPath.includes('?')||objectPath.includes('#'))
   throw new TypeError('Invalid private Storage locator');
  const {data,error}=await storageClient.storage.from('xoxo-reveal').download(objectPath);
  if(error||!data||typeof data.arrayBuffer!=='function')
   throw new Error('Private Storage download unavailable');
  // Check metadata before loading bytes; enforce the limit again afterward.
  if(typeof data.size==='number'&&data.size>maxBytes)
   throw new Error('Private Storage object exceeds byte limit');
  const buffer=await data.arrayBuffer();
  if(!(buffer instanceof ArrayBuffer)||buffer.byteLength<1||buffer.byteLength>maxBytes)
   throw new Error('Private Storage object exceeds byte limit or is empty');
  return new Uint8Array(buffer);
 };
}
// This does not prove writer fencing, authorization or SQL atomicity.
