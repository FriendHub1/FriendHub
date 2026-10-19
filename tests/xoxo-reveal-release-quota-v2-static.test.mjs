import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const sql=readFileSync(new URL("../supabase/migrations/20261019_xoxo_reveal_release_quota_v2_REVIEW_ONLY.sql",import.meta.url),"utf8");
test("refund v2 is server-only",()=>{
 assert.match(sql,/auth\.role\(\) IS DISTINCT FROM 'service_role'/);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.xoxo_reveal_release_quota_v2\(uuid,uuid,uuid\)\s+TO service_role/);
});
test("refund v2 requires verified failed state and blocks completed",()=>{
 assert.match(sql,/v_attempt\.status='completed'/);
 assert.match(sql,/v_attempt\.status <> 'failed'/);
});
test("refund v2 rejects any linked Reveal",()=>{
 assert.match(sql,/r\.upload_attempt_id=p_attempt_id/);
 assert.match(sql,/Linked Reveal requires reconciliation/);
});
test("refund v2 binds exact sender attempt and reservation",()=>{
 assert.match(sql,/a\.id=p_attempt_id AND a\.sender_id=p_sender_id FOR UPDATE/);
 assert.match(sql,/q\.id=p_reservation_id AND q\.upload_attempt_id=p_attempt_id/);
 assert.match(sql,/q\.sender_id=p_sender_id FOR UPDATE/);
});
test("refund v2 is idempotent and explicitly blocks production",()=>{
 assert.match(sql,/RETURN 'already_released'/);
 assert.match(sql,/DO NOT APPLY TO PRODUCTION/);
 assert.match(sql,/Storage \+ DM evidence/);
});
