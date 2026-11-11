import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../supabase/migrations/20261019_xoxo_reveal_quota_REVIEW_ONLY.sql',import.meta.url),'utf8');
const refund=sql.split('CREATE OR REPLACE FUNCTION public.xoxo_reveal_release_quota_v1(')[1]?.split('REVOKE ALL ON FUNCTION public.xoxo_reveal_release_quota_v1')[0];
test('refund updates only matching sender and unreleased reservation',()=>{
 assert.ok(refund);
 assert.match(refund,/WHERE id=p_reservation_id AND sender_id=p_sender_id AND released_at IS NULL/);
 assert.match(refund,/SET released_at=clock_timestamp\(\)/);
 assert.match(refund,/RETURN FOUND;/);
});
test('refund cannot be executed by browser roles',()=>{
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.xoxo_reveal_release_quota_v1\(uuid,uuid\) FROM PUBLIC, anon, authenticated/);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.xoxo_reveal_release_quota_v1\(uuid,uuid\) TO service_role/);
});
