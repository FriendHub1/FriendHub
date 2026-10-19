import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../supabase/migrations/20261019_xoxo_reveal_quota_REVIEW_ONLY.sql',import.meta.url),'utf8');
const refund=sql.split('CREATE OR REPLACE FUNCTION public.xoxo_reveal_release_quota_v1(')[1]?.split('REVOKE ALL ON FUNCTION public.xoxo_reveal_release_quota_v1')[0];
test('SECURITY DEFINER refund never mistakes current_user for invoking caller',()=>{
 assert.ok(refund);
 assert.match(refund,/SECURITY DEFINER/);
 assert.doesNotMatch(refund,/IF current_user\s*(?:<>|=)/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.xoxo_reveal_release_quota_v1\(uuid,uuid\) FROM PUBLIC, anon, authenticated/);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.xoxo_reveal_release_quota_v1\(uuid,uuid\) TO service_role/);
});
