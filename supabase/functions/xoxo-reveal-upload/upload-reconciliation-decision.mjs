// XOXO Reveal BETA — conservative reconciliation decision helper.
// REVIEW ONLY / NOT DEPLOYED. Never automatically retry, seal or deliver an
// uncertain upload. A privileged operator must verify external Storage state.
export function decideRevealUploadReconciliation({
 attempt,objectBinding,storageEvidence
}={}){
 if(!attempt||!attempt.id||!attempt.sender_id)
  return {action:'manual_review',reason:'missing_attempt'};
 if(!attempt.upload_uncertain_at)
  return {action:'no_reconciliation',reason:'not_marked_uncertain'};
 if(attempt.status==='completed')
  return {action:'manual_review',reason:'completed_but_uncertain'};
 if(!objectBinding||objectBinding.attemptId!==attempt.id||
    objectBinding.senderId!==attempt.sender_id)
  return {action:'manual_review',reason:'binding_not_authoritative'};
 if(storageEvidence?.state==='unavailable')
  return {action:'manual_review',reason:'storage_unavailable'};
 if(storageEvidence?.state==='missing')
  return {action:'manual_review',reason:'missing_object_may_be_in_flight'};
 if(storageEvidence?.state==='present'&&
    storageEvidence.digestMatches===true&&
    storageEvidence.writerQuiescent===true)
  return {action:'manual_review',reason:'verified_object_requires_privileged_resolution'};
 return {action:'manual_review',reason:'integrity_or_writer_unverified'};
}
// Even verified bytes do not prove all external writes have settled.
// This helper only classifies cases for manual reconciliation.
