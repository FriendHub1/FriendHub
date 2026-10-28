// XOXO Reveal BETA — injected Storage write coordinator, NOT DEPLOYED.
// Only a real server-side durable writer token/lease + trusted Storage adapter
// can make this safe. Never expose service credentials or object paths.
export async function executeFencedRevealStorageWrite({
 attemptId, senderId, writerToken, claimWriter, verifyWriter,
 uploadPrivateObject, markNeedsReconciliation
}={}){
 const invalid=()=>({ok:false,reason:'invalid_writer_context'});
 if(!attemptId||!senderId||!writerToken||
    [claimWriter,verifyWriter,uploadPrivateObject,markNeedsReconciliation]
      .some(fn=>typeof fn!=='function'))return invalid();
 let claim;
 try{claim=await claimWriter({attemptId,senderId,writerToken});}
 catch{return {ok:false,reason:'claim_uncertain_manual_reconciliation'};}
 if(claim!=='claimed'&&claim!=='already_owned')
  return {ok:false,reason:'writer_not_claimed',claim};
 const verify=async phase=>{
  try{return await verifyWriter({attemptId,senderId,writerToken,phase})===true;}
  catch{return false;}
 };
 if(!await verify('before_upload'))
  return {ok:false,reason:'writer_not_verified_before_upload'};
 let uploadResult;
 try{
  uploadResult=await uploadPrivateObject({attemptId,senderId,writerToken});
 }catch{
  try{await markNeedsReconciliation({attemptId,senderId,writerToken,reason:'storage_write_uncertain'});}
  catch{return {ok:false,reason:'storage_write_uncertain_and_quarantine_failed'};}
  return {ok:false,reason:'storage_write_uncertain_manual_reconciliation'};
 }
 // Supabase Storage adapters may resolve with {data:null,error} instead
 // of throwing. Never treat such a response as an acknowledged write.
 if(!uploadResult||uploadResult.stored!==true){
  try{await markNeedsReconciliation({attemptId,senderId,writerToken,reason:'storage_ack_missing'});}
  catch{return {ok:false,reason:'storage_ack_missing_and_quarantine_failed'};}
  return {ok:false,reason:'storage_ack_missing_manual_reconciliation'};
 }
 // A successful Storage response still needs durable token verification.
 if(!await verify('after_upload')){
  try{await markNeedsReconciliation({attemptId,senderId,writerToken,reason:'post_upload_writer_unverified'});}
  catch{return {ok:false,reason:'post_upload_writer_unverified_and_quarantine_failed'};}
  return {ok:false,reason:'post_upload_writer_unverified_manual_reconciliation'};
 }
 return {ok:true,reason:'storage_write_acknowledged_needs_db_link',uploadResult};
}
// No automatic delete, refund, DM link, or retry. A successful return does NOT
// prove atomicity with Supabase Storage or permit finalization without DB checks.
