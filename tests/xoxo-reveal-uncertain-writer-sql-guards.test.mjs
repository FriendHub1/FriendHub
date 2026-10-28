import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root='../supabase/migrations/';
function read(name){return readFileSync(new URL(root+name,import.meta.url),'utf8');}
test('begin, renew, seal and active-writer checks reject uncertainty',()=>{
 for(const name of [
  '20261019_xoxo_reveal_writer_lease_lifecycle_v3_REVIEW_ONLY.sql',
  '20261019_xoxo_reveal_writer_lease_v3_REVIEW_ONLY.sql',
  '20261019_xoxo_reveal_active_writer_v2_REVIEW_ONLY.sql'
 ]){
  const sql=read(name);
  assert.match(sql,/upload_uncertain_at IS NOT NULL|upload_uncertain_at IS NULL/,name);
  assert.match(sql,/FOR UPDATE/,name);
 }
 const lifecycle=read('20261019_xoxo_reveal_writer_lease_lifecycle_v3_REVIEW_ONLY.sql');
 assert.equal((lifecycle.match(/v_row\.upload_uncertain_at IS NOT NULL/g)||[]).length,2);
});
test('finalize rejects uncertain outcome under locked attempt',()=>{
 const sql=read('20261019_xoxo_reveal_finalize_upload_v2_REVIEW_ONLY.sql');
 assert.match(sql,/v_attempt\.upload_uncertain_at IS NOT NULL/);
 assert.match(sql,/Upload outcome requires reconciliation/);
 assert.match(sql,/FOR UPDATE/);
});
