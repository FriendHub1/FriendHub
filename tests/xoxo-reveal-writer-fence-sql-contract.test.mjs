import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../supabase/migrations/20261019_xoxo_reveal_writer_fence_v1_REVIEW_ONLY.sql',import.meta.url),'utf8');
test('writer verifier is server-only and checks token plus sender',()=>{
 assert.match(sql,/auth\.role\(\) IS DISTINCT FROM 'service_role'/);
 assert.match(sql,/a\.id=p_attempt_id AND a\.sender_id=p_sender_id FOR UPDATE/);
 assert.match(sql,/claim_token IS NOT DISTINCT FROM p_writer_token/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.xoxo_reveal_verify_writer_v1/);
 assert.match(sql,/TO service_role/);
});
test('writer verification explicitly disclaims full Storage fencing',()=>{
 assert.match(sql,/cannot fence a concurrent/);
 assert.match(sql,/Not deployment ready/);
});
