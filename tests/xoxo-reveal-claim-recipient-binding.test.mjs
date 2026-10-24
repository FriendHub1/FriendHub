import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../supabase/migrations/20261019_xoxo_reveal_claim_upload_v2_REVIEW_ONLY.sql',import.meta.url),'utf8');
test('upload claim stores and verifies recipient identity',()=>{
 assert.match(sql,/p_recipient_id uuid/);
 assert.match(sql,/sender_id,recipient_id,request_key,payload_fingerprint/);
 assert.match(sql,/v_row\.recipient_id IS DISTINCT FROM p_recipient_id/);
 assert.match(sql,/p_sender_id=p_recipient_id/);
});
