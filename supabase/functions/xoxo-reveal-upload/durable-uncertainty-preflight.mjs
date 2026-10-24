// XOXO Reveal BETA — server-side preflight against a persisted uncertainty flag.
// REVIEW ONLY / NOT DEPLOYED. This read is NOT an atomic lock or durable
// Storage fence; it only prevents starting an already-uncertain attempt.
export function createRevealDurableUncertaintyPreflight({readAttempt,uploadAndSeal}={}){
 if(typeof readAttempt!=='function'||typeof uploadAndSeal!=='function')
  throw new TypeError('Trusted attempt reader and upload required');
 return async function guardedUpload(input={}){
  const {attemptId,senderId}=input;
  if([attemptId,senderId].some(v=>typeof v!=='string'||!v.trim()))
   throw new TypeError('Valid attempt identity required');
  let attempt;
  try{attempt=await readAttempt({attemptId,senderId});}
  catch{throw new Error('Durable upload preflight unavailable');}
  if(!attempt||attempt.id!==attemptId||attempt.sender_id!==senderId||
     attempt.status!=='pending'||attempt.upload_uncertain_at!=null)
   throw new Error('Upload blocked by durable attempt state; reconciliation required');
  // Await the guarded operation so no caller can observe an unhandled
  // rejection outside this boundary.
  return await uploadAndSeal(input);
 };
}
// Must be paired with a DB-atomic writer claim and fencing. Two processes can
// pass this preflight concurrently, so it must NEVER be the only upload guard.
