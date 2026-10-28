// XOXO Reveal BETA — HTTP boundary helpers, NOT DEPLOYED.
// Enforces small request bodies before decoding. Never accepts client sender IDs.
export const MAX_UPLOAD_BODY_BYTES=15*1024*1024+4096;
export function validateUploadRequest(request,{allowedOrigin}) {
  const origin=request.headers.get("origin");
  if(!allowedOrigin || origin!==allowedOrigin) return {status:403,error:"Origin denied"};
  if(request.method!=="POST") return {status:405,error:"Method not allowed"};
  const contentType=request.headers.get("content-type")||"";
  if(!["image/webp","video/mp4","video/webm"].includes(contentType))
    return {status:415,error:"Unsupported media type"};
  const length=request.headers.get("content-length");
  if(length!==null){
    if(!/^\d+$/.test(length))return {status:400,error:"Invalid content length"};
    if(Number(length)>MAX_UPLOAD_BODY_BYTES)return {status:413,error:"Upload too large"};
  }
  if(!request.headers.get("authorization"))return {status:401,error:"Authentication required"};
  return null;
}
export async function readBoundedUploadBody(request,{maxBytes=MAX_UPLOAD_BODY_BYTES}={}) {
  if(!request.body)throw new Error("Empty upload");
  const reader=request.body.getReader();
  const chunks=[];let total=0;
  try{
    while(true){
      const {done,value}=await reader.read();
      if(done)break;
      total+=value.byteLength;
      if(total>maxBytes)throw new Error("Upload too large");
      chunks.push(value);
    }
  }catch(error){await reader.cancel().catch(()=>{});throw error;}
  finally{reader.releaseLock();}
  if(total===0)throw new Error("Empty upload");
  const bytes=new Uint8Array(total);let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  return bytes;
}
// Further gates before deployment: JWT validation, per-user rate limiting,
// metadata from trusted headers, backend permission check, transactional DM
// creation, anti-abuse controls and streaming storage upload.
