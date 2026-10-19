import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../supabase/migrations/20261019_xoxo_reveal_quota_REVIEW_ONLY.sql',import.meta.url),'utf8');
const refund=sql.split('CREATE OR REPLACE FUNCTION public.xoxo_reveal_release_quota_v1(')[1]?.split('REVOKE ALL ON FUNCTION public.xoxo_reveal_release_quota_v1')[0];
test('SECURITY DEFINER quota refund enforces privileged caller inside function',()=>{
 assert.ok(refund);
 assert.match(refund,/SECURITY DEFINER/);
 assert.match(refund,/current_user <> 'service_role'/);
 assert.match(refund,/RAISE EXCEPTION 'Service role required'/);
});
