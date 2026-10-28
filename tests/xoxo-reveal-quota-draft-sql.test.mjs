import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../supabase/migrations/20261019_xoxo_reveal_quota_REVIEW_ONLY.sql',import.meta.url),'utf8');
test('quota refund SQL function has paired PostgreSQL dollar delimiters',()=>{
 const match=sql.match(/CREATE OR REPLACE FUNCTION public\.xoxo_reveal_release_quota_v1\([\s\S]*?GRANT EXECUTE/);
 assert.ok(match,'refund function must exist');
 assert.match(match[0],/AS \$\$\s*BEGIN/);
 assert.match(match[0],/END;\s*\$\$;/);
});
test('refund remains service-only and migration remains review-only',()=>{
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.xoxo_reveal_release_quota_v1\(uuid,uuid\) FROM PUBLIC, anon, authenticated/);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.xoxo_reveal_release_quota_v1\(uuid,uuid\) TO service_role/);
 assert.match(sql,/DO NOT APPLY TO PRODUCTION/);
});
