import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../supabase/migrations/20261019_xoxo_reveal_quota_REVIEW_ONLY.sql',import.meta.url),'utf8');
test('refund function removes PUBLIC and browser EXECUTE before granting service_role',()=>{
 const revoke=sql.indexOf('REVOKE ALL ON FUNCTION public.xoxo_reveal_release_quota_v1(uuid,uuid) FROM PUBLIC, anon, authenticated;');
 const grant=sql.indexOf('GRANT EXECUTE ON FUNCTION public.xoxo_reveal_release_quota_v1(uuid,uuid) TO service_role;');
 assert.ok(revoke>=0&&grant>revoke);
});
test('refund migration keeps explicit deployment blockers',()=>{
 assert.match(sql,/REVIEW ONLY \/ DO NOT APPLY TO PRODUCTION/);
 assert.match(sql,/role\/function ownership/);
 assert.match(sql,/server refund authorization/);
});
