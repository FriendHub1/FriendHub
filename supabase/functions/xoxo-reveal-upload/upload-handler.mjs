// XOXO Reveal BETA — secure-upload orchestration draft, NOT DEPLOYED.
// All privileged operations are injected and must be implemented server-side.
// Never accept sender identity, storage path, or DM linkage from the client.
import {inspectRevealUpload} from "./upload-policy.mjs";

export async function handleRevealUpload({
  authenticatedSenderId, recipientId, bytes, claimedType, mode, seconds,
  authorizeDm, createPrivateObject, createLinkedMessage, deletePrivateObject,
  generateObjectPath
}) {
  if (![authorizeDm,createPrivateObject,createLinkedMessage,deletePrivateObject,generateObjectPath]
    .every(fn=>typeof fn==="function")) throw new TypeError("Missing secure server dependencies");
  if (!authenticatedSenderId || !recipientId) throw new Error("Authentication and recipient required");
  const meta=inspectRevealUpload({
    bytes,claimedType,senderId:authenticatedSenderId,recipientId,mode,seconds
  });
  // Authorization MUST run before any Storage operation.
  const allowed=await authorizeDm({senderId:authenticatedSenderId,recipientId});
  if (allowed!==true) throw new Error("DM not authorized");
  const objectPath=generateObjectPath({senderId:authenticatedSenderId,recipientId});
  if(typeof objectPath!=="string" || !objectPath ||
     objectPath.startsWith("/") || objectPath.includes(".."))
    throw new Error("Invalid private object path");
  let uploaded=false;
  try {
    await createPrivateObject({objectPath,bytes,contentType:meta.mime});
    uploaded=true;
    const linked=await createLinkedMessage({
      senderId:authenticatedSenderId,recipientId,objectPath,
      mediaType:meta.mediaType,mode:meta.mode,durationSeconds:meta.durationSeconds
    });
    if(!linked?.revealId || !linked?.dmId) throw new Error("Invalid linked message");
    return {revealId:linked.revealId,dmId:linked.dmId};
  } catch(error) {
    if(uploaded) {
      try { await deletePrivateObject({objectPath}); }
      catch(cleanupError) {
        // Caller must log and queue orphan cleanup; never reveal object path to client.
        throw new AggregateError([error,cleanupError],"Upload failed and cleanup required");
      }
    }
    throw error;
  }
}
// RELEASE BLOCKERS: real JWT verification, server-only credentials, DB transaction
// and RLS checks, rate limits, virus/content scanning, MIME and duration validation,
// safe upload retries, orphan cleanup and moderation/report retention.
