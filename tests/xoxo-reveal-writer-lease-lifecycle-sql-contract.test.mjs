import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../supabase/migrations/20261019_xoxo_reveal_writer_lease_lifecycle_v3_REVIEW_ONLY.sql',import.meta.url),'utf8');
test('begin v3 initializes lease only for idle owner under lock',()=>{
 assert.match(sql,/xoxo_reveal_writer_begin_v3/);
 assert.match(sql,/writer_state<>'idle'/);
 assert.match(sql,/writer_lease_expires_at=clock_timestamp\(\)\+make_interval/);
 assert.match(sql,/p_lease_seconds NOT BETWEEN 15 AND 120/);
});
test('seal v3 requires unexpired lease and clears it atomically',()=>{
 assert.match(sql,/xoxo_reveal_writer_seal_v3/);
 assert.match(sql,/writer_state<>'writing'/);
 assert.match(sql,/writer_lease_expires_at<=clock_timestamp\(\)/);
 assert.match(sql,/writer_state='sealed',writer_lease_expires_at=NULL/);
 assert.equal((sql.match(/FOR UPDATE/g)||[]).length,2);
});
test('begin and seal RPCs are privileged and explicitly not deployment ready',()=>{
 assert.equal((sql.match(/auth\.role\(\) IS DISTINCT FROM 'service_role'/g)||[]).length,2);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.xoxo_reveal_writer_begin_v3/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.xoxo_reveal_writer_seal_v3/);
 assert.match(sql,/remain release blockers/);
});
