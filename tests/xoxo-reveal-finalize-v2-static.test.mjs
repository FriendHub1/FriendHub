import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const sql=readFileSync(new URL("../supabase/migrations/20261019_xoxo_reveal_finalize_upload_v2_REVIEW_ONLY.sql",import.meta.url),"utf8");
test("finalize v2 is server only and fenced by claim token",()=>{
 assert.match(sql,/auth\.role\(\) IS DISTINCT FROM 'service_role'/);
 assert.match(sql,/v_attempt\.claim_token IS DISTINCT FROM p_claim_token/);
 assert.match(sql,/FOR UPDATE/);
});
test("finalize v2 binds exact attempt, sender, recipient, DM and payload",()=>{
 for(const required of [
  "r.upload_attempt_id=v_attempt.id","r.sender_id=v_attempt.sender_id",
  "r.recipient_id=d.recipient_id","r.dm_id=p_dm_id",
  "r.payload_fingerprint=v_attempt.payload_fingerprint"
 ]) assert.ok(sql.includes(required),required);
});
test("finalize v2 binds trusted private object and active quota",()=>{
 for(const required of [
  "o.attempt_id=v_attempt.id","o.object_path=r.object_path",
  "o.bucket_id='xoxo-reveal'","o.payload_fingerprint=v_attempt.payload_fingerprint",
  "q.upload_attempt_id=v_attempt.id","q.released_at IS NULL"
 ]) assert.ok(sql.includes(required),required);
});
test("finalize v2 keeps completed idempotent and refuses conflicting results",()=>{
 assert.match(sql,/RETURN 'already_completed'/);
 assert.match(sql,/Conflicting completed attempt/);
 assert.match(sql,/status <> 'pending'/);
});
test("finalize v2 explicitly remains review-only",()=>{
 assert.match(sql,/DO NOT APPLY/);
 assert.match(sql,/Storage and DB cannot commit atomically/);
});
