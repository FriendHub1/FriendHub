// XOXO Reveal BETA — rate-limit decision helper, NOT DEPLOYED.
// Caller must use an atomic, shared server-side counter (not browser state).
export const REVEAL_RATE_POLICY=Object.freeze({
  uploadsPerHour:120,
  bytesPerHour:1200*1024*1024,
  uploadsPerDay:600
});
export function checkRevealRateLimit({
  hourlyUploads,hourlyBytes,dailyUploads,incomingBytes,
  policy=REVEAL_RATE_POLICY
}){
  for(const value of [hourlyUploads,hourlyBytes,dailyUploads,incomingBytes]){
    if(!Number.isSafeInteger(value)||value<0)throw new TypeError("Invalid rate counter");
  }
  if(hourlyUploads>=policy.uploadsPerHour)
    return {allowed:false,reason:"hourly_upload_count"};
  if(dailyUploads>=policy.uploadsPerDay)
    return {allowed:false,reason:"daily_upload_count"};
  if(incomingBytes>policy.bytesPerHour ||
    hourlyBytes>policy.bytesPerHour-incomingBytes)
    return {allowed:false,reason:"hourly_bytes"};
  return {allowed:true,reason:null};
}
// SECURITY: A read-then-write counter is race-prone. Production must reserve
// quota atomically before upload and refund on failure. Authenticated sender
// ID must come from verified JWT. Enforce IP-based abuse controls separately.
