// Structural regression tests for the review-only finalize SQL.
// These do NOT establish database execution or concurrency safety.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../supabase/migrations/20261019_xoxo_reveal_finalize_upload_v2_REVIEW_ONLY.sql',import.meta.url),'utf8');
test('finalize draft explicitly checks both directions of blocks',()=>{
 assert.match(sql,/FROM public\.user_blocks b/);
 assert.match(sql,/b\.blocker_id=r\.sender_id AND b\.blocked_id=r\.recipient_id/);
 assert.match(sql,/b\.blocker_id=r\.recipient_id AND b\.blocked_id=r\.sender_id/);
 assert.match(sql,/Current DM relationship is blocked/);
});
test('finalize draft requires prior DM or accepted message request',()=>{
 assert.match(sql,/FROM public\.direct_messages d/);
 assert.match(sql,/FROM public\.message_requests mr/);
 assert.match(sql,/mr\.status='accepted'/);
 assert.match(sql,/Current DM relationship is not authorized/);
});
test('finalize draft retains server-only execution and attempt ownership',()=>{
 assert.match(sql,/auth\.role\(\) IS DISTINCT FROM 'service_role'/);
 assert.match(sql,/v_attempt\.claim_token IS DISTINCT FROM p_claim_token/);
 assert.match(sql,/v_attempt\.writer_state IS DISTINCT FROM 'sealed'/);
 assert.match(sql,/v_attempt\.upload_uncertain_at IS NOT NULL/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.xoxo_reveal_finalize_upload_v2/);
});

test('DM authorization checks occur after attempt lock but before completion update',()=>{
 const lock=sql.indexOf('FOR UPDATE;');
 const blocks=sql.indexOf('FROM public.user_blocks b');
 const relationship=sql.indexOf('FROM public.message_requests mr');
 const update=sql.indexOf('UPDATE public.xoxo_reveal_upload_attempts');
 assert.ok(lock>=0&&blocks>lock&&relationship>blocks&&update>relationship);
});
test('review-only SQL explicitly warns concurrent blocks are not serialized',()=>{
 assert.match(sql,/do not lock a future block INSERT/);
 assert.match(sql,/before production/);
});
