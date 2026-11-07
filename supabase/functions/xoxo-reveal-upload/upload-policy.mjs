// XOXO Reveal BETA — pure upload authorization checks, NOT DEPLOYED.
// Never trust a sender ID, object path or media type supplied by the browser.
export const MAX_IMAGE_BYTES=900*1024;
export const MAX_VIDEO_BYTES=15*1024*1024;
export function inspectRevealUpload({bytes,claimedType,recipientId,senderId,mode,seconds}) {
  if (!(bytes instanceof Uint8Array) || !bytes.length) throw new Error("Empty upload");
  if (!senderId || !recipientId || senderId===recipientId) throw new Error("Invalid participants");
  if (!["once","timed","keep"].includes(mode)) throw new Error("Invalid mode");
  if (mode==="timed" ? ![5,10,15,20].includes(seconds) : seconds!=null)
    throw new Error("Invalid duration");
  const webp=bytes.length>=12 && [82,73,70,70].every((v,i)=>bytes[i]===v) &&
    [87,69,66,80].every((v,i)=>bytes[i+8]===v);
  const mp4=bytes.length>=12 && [102,116,121,112].every((v,i)=>bytes[i+4]===v);
  const webm=bytes.length>=4 && [26,69,223,163].every((v,i)=>bytes[i]===v);
  let mediaType,mime;
  if(webp && claimedType==="image/webp" && bytes.length<=MAX_IMAGE_BYTES){
    mediaType="image";mime="image/webp";
  } else if(mp4 && claimedType==="video/mp4" && bytes.length<=MAX_VIDEO_BYTES){
    mediaType="video";mime="video/mp4";
  } else if(webm && claimedType==="video/webm" && bytes.length<=MAX_VIDEO_BYTES){
    mediaType="video";mime="video/webm";
  } else throw new Error("Unsupported or oversized media");
  return {mediaType,mime,bytes:bytes.length,mode,durationSeconds:mode==="timed"?seconds:null};
}
// Server endpoint must independently authenticate sender, verify accepted DM
// relationship and blocks, use a server-generated object path, then atomically
// create a DM and Reveal record. This helper alone grants no upload permission.
// Container metadata and video duration require separate server-side inspection.
