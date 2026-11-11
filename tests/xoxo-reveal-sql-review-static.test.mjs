import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const root=new URL("../supabase/migrations/",import.meta.url);
const read=name=>readFileSync(new URL(name,root),"utf8");
const quota=read("20261019_xoxo_reveal_quota_isolated_v2_REVIEW_ONLY.sql");
const base=read("20261019_xoxo_reveal_beta_REVIEW_ONLY.sql");
const attempts=read("20261019_xoxo_reveal_idempotency_REVIEW_ONLY.sql");
const links=read("20261019_xoxo_reveal_reconciliation_links_REVIEW_ONLY.sql");
const claim=read("20261019_xoxo_reveal_claim_upload_v2_REVIEW_ONLY.sql");
const finalize=read("20261019_xoxo_reveal_finalize_upload_v1_REVIEW_ONLY.sql");
test("isolated quota SQL uses balanced tagged function delimiters",()=>{
 assert.equal((quota.match(/\$function\$/g)||[]).length,4);
 assert.doesNotMatch(quota,/AS\s+\$\s*\n/i);
});
test("quota preserves agreed generous limits",()=>{
 assert.match(quota,/v_hour_count\s*>=\s*120/);
 assert.match(quota,/v_day_count\s*>=\s*600/);
 assert.match(quota,/1200::bigint\s*\*\s*1024\s*\*\s*1024/);
});
test("refund RPC is restricted to service role",()=>{
 assert.match(quota,/auth\.role\(\) IS DISTINCT FROM 'service_role'/);
 assert.match(quota,/GRANT EXECUTE ON FUNCTION public\.xoxo_reveal_release_quota_v1\(uuid,uuid\)\s+TO service_role/);
});
test("draft tables and claim/finalize functions have dependencies",()=>{
 assert.match(base,/CREATE TABLE IF NOT EXISTS public\.xoxo_reveals/);
 assert.match(attempts,/CREATE TABLE IF NOT EXISTS public\.xoxo_reveal_upload_attempts/);
 assert.match(quota,/CREATE TABLE IF NOT EXISTS public\.xoxo_reveal_quota_reservations/);
 assert.match(links,/CREATE TABLE IF NOT EXISTS public\.xoxo_reveal_upload_objects/);
 assert.match(claim,/CREATE OR REPLACE FUNCTION public\.xoxo_reveal_claim_upload_v2/);
 assert.match(finalize,/CREATE OR REPLACE FUNCTION public\.xoxo_reveal_finalize_upload_v1/);
});
test("review-only drafts explicitly prohibit production application",()=>{
 for(const sql of [base,attempts,quota,links,claim,finalize])
  assert.match(sql,/DO NOT APPLY|NEVER APPLY|NOT DEPLOYED/i);
});
