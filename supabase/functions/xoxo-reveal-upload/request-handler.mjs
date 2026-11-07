// XOXO Reveal BETA — authenticated upload entrypoint, NOT DEPLOYED.
// Server dependencies are injected. No production writes are performed here.
import { authenticateRevealSender } from "./authenticate.mjs";
import { handleRevealUpload } from "./upload-handler.mjs";

export async function processRevealUploadRequest({
  authorization, authClient, recipientId, bytes, claimedType, mode, seconds,
  authorizeDm, createPrivateObject, createLinkedMessage,
  deletePrivateObject, generateObjectPath
}) {
  // Verify caller before inspecting or processing the upload.
  const {senderId}=await authenticateRevealSender({authorization,authClient});
  return handleRevealUpload({
    authenticatedSenderId:senderId,recipientId,bytes,claimedType,mode,seconds,
    authorizeDm,createPrivateObject,createLinkedMessage,
    deletePrivateObject,generateObjectPath
  });
}
// Production Edge handler still needed: enforce Content-Length/body cap,
// CORS, rate limits, media scanning, DB transaction, RLS/blocks, private
// Storage permissions, secure errors and retries. No service-role secrets
// or sender identity should be provided by the browser.
