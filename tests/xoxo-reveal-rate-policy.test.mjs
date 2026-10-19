import test from "node:test";
import assert from "node:assert/strict";
import {checkRevealRateLimit,REVEAL_RATE_POLICY} from "../supabase/functions/xoxo-reveal-upload/rate-policy.mjs";
const base={hourlyUploads:0,hourlyBytes:0,dailyUploads:0,incomingBytes:1024};
test("allows normal small upload",()=>{
 assert.deepEqual(checkRevealRateLimit(base),{allowed:true,reason:null});
});
test("blocks hourly upload count",()=>{
 assert.equal(checkRevealRateLimit({...base,hourlyUploads:REVEAL_RATE_POLICY.uploadsPerHour}).reason,"hourly_upload_count");
});
test("blocks daily upload count",()=>{
 assert.equal(checkRevealRateLimit({...base,dailyUploads:REVEAL_RATE_POLICY.uploadsPerDay}).reason,"daily_upload_count");
});
test("blocks hourly byte budget",()=>{
 assert.equal(checkRevealRateLimit({...base,hourlyBytes:REVEAL_RATE_POLICY.bytesPerHour}).reason,"hourly_bytes");
});
test("rejects invalid counters",()=>{
 assert.throws(()=>checkRevealRateLimit({...base,hourlyUploads:-1}),/Invalid rate counter/);
});
