// XOXO Reveal BETA — read-only evidence aggregator, NOT DEPLOYED.
// Only trusted server readers may be injected. Each reader must query an
// authoritative source; boolean flags are not accepted from the caller.
export function createRevealBindingEvidenceReader({
 readAttempt,readRevealDm,readStorageIntegrity,readQuota,readWriter
}={}){
 if([readAttempt,readRevealDm,readStorageIntegrity,readQuota,readWriter]
   .some(fn=>typeof fn!=='function'))
  throw new TypeError('Five trusted evidence readers required');
 return async function readTrustedEvidence(ctx={}){
  const {attemptId,senderId,revealId,dmId,objectPath,payloadFingerprint}=ctx;
  if([attemptId,senderId,revealId,dmId,objectPath,payloadFingerprint]
    .some(x=>typeof x!=='string'||!x.trim())||
    !/^[a-f0-9]{64}$/.test(payloadFingerprint)||
    objectPath.startsWith('/')||objectPath.includes('..')||
    objectPath.includes('\\')||objectPath.includes('?')||objectPath.includes('#'))
   throw new TypeError('Invalid binding identifiers');
  // Sequential reads avoid presenting this as an atomic snapshot.
  // A real finalizer must fence writers and revalidate in SQL.
  const a=await readAttempt({attemptId,senderId});
  const link=await readRevealDm({attemptId,revealId,dmId});
  const storage=await readStorageIntegrity({attemptId,objectPath,payloadFingerprint});
  const quota=await readQuota({attemptId,senderId});
  const writer=await readWriter({attemptId,senderId});
  const exact= a?.authoritative===true && a.id===attemptId &&
   a.senderId===senderId && a.payloadFingerprint===payloadFingerprint &&
   link?.authoritative===true && link.attemptId===attemptId &&
   link.revealId===revealId && link.dmId===dmId &&
   link.senderId===senderId && link.objectPath===objectPath &&
   link.payloadFingerprint===payloadFingerprint &&
   storage?.authoritative===true && storage.objectPath===objectPath &&
   storage.payloadFingerprint===payloadFingerprint &&
   quota?.authoritative===true && quota.attemptId===attemptId &&
   quota.senderId===senderId && writer?.authoritative===true &&
   writer.attemptId===attemptId && writer.senderId===senderId;
  return {
   attemptId,senderId,revealId,dmId,objectPath,payloadFingerprint,
   authoritative:exact===true,
   storageObjectVerified:storage?.exists===true,
   storageDigestMatches:storage?.digestVerified===true,
   dmAuthorizedAtLink:link?.authorizedAtLink===true,
   recipientMatches:link?.recipientMatches===true,
   quotaReservationBound:quota?.active===true,
   writerStateSafe:writer?.safeForFinalize===true
  };
 };
}
// The evidence reader does not make Storage and PostgreSQL atomic.
// Never finalize based solely on these reads without transactional rechecks.
