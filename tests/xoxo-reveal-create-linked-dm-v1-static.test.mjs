import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../supabase/migrations/20261019_xoxo_reveal_create_linked_dm_v1_REVIEW_ONLY.sql',import.meta.url),'utf8');
test('atomic linked delivery is server-only and inserts both rows in one function',()=>{
 assert.match(sql,/auth\.role\(\) IS DISTINCT FROM 'service_role'/);
 assert.match(sql,/INSERT INTO public\.direct_messages/);
 assert.match(sql,/INSERT INTO public\.xoxo_reveals/);
 assert.match(sql,/REVOKE ALL ON FUNCTION/);
 assert.match(sql,/TO service_role/);
});
test('draft refuses unsealed or uncertain uploads and requires private object and quota binding',()=>{
 for(const token of ["writer_state='sealed'","upload_uncertain_at IS NULL","bucket_id='xoxo-reveal'","released_at IS NULL","FOR UPDATE"])
  assert.ok(sql.includes(token),token);
});
test('draft checks blocks in both directions and requires existing DM or accepted request',()=>{
 for(const token of ["b.blocker_id=p_sender_id","b.blocker_id=p_recipient_id","m.status='accepted'","DM relationship not authorized"])
  assert.ok(sql.includes(token),token);
});
