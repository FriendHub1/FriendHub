// XOXO Reveal BETA — atomic quota reservation orchestration (NOT DEPLOYED).
// reserveQuota MUST be an atomic, persistent, server-side operation keyed by
// authenticated sender; releaseQuota MUST be idempotent by reservation ID.
import {processRevealUploadRequest} from "./request-handler.mjs";
import {authenticateRevealSender} from "./authenticate.mjs";

export async function processQuotaProtectedRevealUpload({
  authorization,authClient,bytes,reserveQuota,releaseQuota,...uploadDependencies
}) {
  if(typeof reserveQuota!=="function" || typeof releaseQuota!=="function")
    throw new TypeError("Atomic quota dependencies required");
  // Verify sender before any quota operation; never trust a browser sender ID.
  const {senderId}=await authenticateRevealSender({authorization,authClient});
  if(!(bytes instanceof Uint8Array) || bytes.byteLength===0)
    throw new Error("Invalid upload body");
  const reservation=await reserveQuota({senderId,bytes:bytes.byteLength});
  if(!reservation?.allowed || !reservation?.id)
    throw new Error("Reveal quota exceeded");
  try {
    // Existing handler independently verifies the token and DM permissions.
    return await processRevealUploadRequest({
      authorization,authClient,bytes,...uploadDependencies
    });
  } catch(error) {
    try { await releaseQuota({senderId,reservationId:reservation.id}); }
    catch(refundError) {
      throw new AggregateError([error,refundError],"Reveal upload failed; quota reconciliation required");
    }
    throw error;
  }
}
// SECURITY REVIEW: reservation expiry, duplicate/idempotent request handling,
// post-commit ambiguity, retry semantics, quota transaction isolation, rate
// limiting of rejected attempts, and cleanup reconciliation remain blockers.
// Do not wire this into production until the DB-backed implementation is audited.
