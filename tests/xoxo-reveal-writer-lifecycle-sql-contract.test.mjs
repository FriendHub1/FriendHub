import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../supabase/migrations/20261019_xoxo_reveal_writer_lifecycle_v2_REVIEW_ONLY.sql',import.meta.url),'utf8');
test('writer begin and seal are service-only row-serialized transitions',()=>{
 assert.match(sql,/writer_state IN \('idle','writing','sealed'\)/);
 assert.match(sql,/xoxo_reveal_writer_begin_v2/);
 assert.match(sql,/xoxo_reveal_writer_seal_v2/);
 assert.equal((sql.match(/FOR UPDATE/g)||[]).length,2);
 assert.equal((sql.match(/auth\.role\(\) IS DISTINCT FROM 'service_role'/g)||[]).length,2);
 assert.match(sql,/writer_state<>'idle'/);
 assert.match(sql,/writer_state<>'writing'/);
 assert.match(sql,/writer_state='sealed'/);
});
test('writer lifecycle forbids browser execute and identifies Storage release blockers',()=>{
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.xoxo_reveal_writer_begin_v2/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.xoxo_reveal_writer_seal_v2/);
 assert.match(sql,/prevent signed-token reuse/);
 assert.match(sql,/SQL alone cannot fence external Storage/);
});
