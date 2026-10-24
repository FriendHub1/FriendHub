import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../supabase/migrations/20261019_xoxo_reveal_writer_lease_v3_REVIEW_ONLY.sql',import.meta.url),'utf8');
test('lease renewal locks attempt and verifies owner, active state, unexpired lease',()=>{
 assert.match(sql,/FOR UPDATE/);
 assert.match(sql,/a\.id=p_attempt_id AND a\.sender_id=p_sender_id/);
 assert.match(sql,/writer_state<>'writing'/);
 assert.match(sql,/claim_token IS DISTINCT FROM p_writer_token/);
 assert.match(sql,/writer_lease_expires_at<=clock_timestamp\(\)/);
});
test('lease duration is bounded and RPC is service-only',()=>{
 assert.match(sql,/p_lease_seconds NOT BETWEEN 15 AND 120/);
 assert.match(sql,/auth\.role\(\) IS DISTINCT FROM 'service_role'/);
 assert.match(sql,/REVOKE ALL ON FUNCTION/);
 assert.match(sql,/TO service_role/);
});
test('draft explicitly rejects lease expiry as proof Storage upload stopped',()=>{
 assert.match(sql,/Lease expiry alone cannot cancel an external Storage write/);
});
