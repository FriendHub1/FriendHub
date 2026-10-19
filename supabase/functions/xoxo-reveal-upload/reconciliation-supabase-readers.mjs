// XOXO Reveal BETA — privileged, read-only reconciliation readers.
// REVIEW ONLY / NOT DEPLOYED. The caller must supply a server-only Supabase
// client and a separately implemented, trusted reviewer authorization callback.
export function createRevealReconciliationSupabaseReaders({supabase}={}){
 if(typeof supabase?.from!=='function')throw new TypeError('Trusted Supabase client required');
 async function one(table,fields,filters){
  let query=supabase.from(table).select(fields);
  for(const [key,value] of Object.entries(filters))query=query.eq(key,value);
  const {data,error}=await query.maybeSingle();
  if(error)throw new Error('Reconciliation evidence unavailable');
  return data??null;
 }
 return {
  async readAttempt({attemptId}={}){
   if(typeof attemptId!=='string'||!attemptId.trim())
    throw new TypeError('Attempt ID required');
   return one('xoxo_reveal_upload_attempts',
    'id,sender_id,status,upload_uncertain_at,upload_uncertain_reason',
    {id:attemptId});
  },
  async readObjectBinding({attemptId,senderId}={}){
   if([attemptId,senderId].some(value=>typeof value!=='string'||!value.trim()))
    throw new TypeError('Binding identity required');
   const data=await one('xoxo_reveal_upload_objects',
    'attempt_id,sender_id,bucket_id,object_path,expected_sha256',
    {attempt_id:attemptId,sender_id:senderId});
   if(!data)return null;
   return {attemptId:data.attempt_id,senderId:data.sender_id,
    bucketId:data.bucket_id,objectPath:data.object_path,
    expectedSha256:data.expected_sha256};
  }
 };
}
// Storage evidence must be obtained from a separate trusted byte-integrity
// reader; metadata alone is never proof of a settled external write.
