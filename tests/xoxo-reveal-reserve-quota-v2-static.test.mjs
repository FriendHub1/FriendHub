import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const sql=readFileSync(new URL("../supabase/migrations/20261019_xoxo_reveal_reserve_quota_v2_REVIEW_ONLY.sql",import.meta.url),"utf8");
test("quota v2 is server only",()=>{
 assert.match(sql,/auth\.role\(\) IS DISTINCT FROM 'service_role'/);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.xoxo_reveal_reserve_quota_v2\(uuid,uuid,uuid,bigint\)\s+TO service_role/);
});
test("quota v2 validates ownership and pending claim",()=>{
 assert.match(sql,/v_attempt\.status <> 'pending'/);
 assert.match(sql,/v_attempt\.claim_token IS DISTINCT FROM p_claim_token/);
 assert.match(sql,/a\.id=p_attempt_id AND a\.sender_id=p_sender_id FOR UPDATE/);
});
test("quota v2 enforces one reservation per attempt",()=>{
 assert.match(sql,/q\.upload_attempt_id=p_attempt_id FOR UPDATE/);
 assert.match(sql,/v_existing\.byte_count <> p_bytes/);
 assert.match(sql,/v_existing\.released_at IS NOT NULL/);
 assert.match(sql,/VALUES\(p_sender_id,p_bytes,p_attempt_id\)/);
});
test("quota v2 preserves limits and serializes sender",()=>{
 assert.match(sql,/pg_advisory_xact_lock/);
 assert.match(sql,/v_hour_count >= 120/);
 assert.match(sql,/v_day_count >= 600/);
 assert.match(sql,/1200::bigint \* 1024 \* 1024/);
});
test("quota v2 is review only with no deployment approval",()=>{
 assert.match(sql,/DO NOT APPLY TO PRODUCTION/);
 assert.match(sql,/isolated PostgreSQL and concurrency testing/);
});
