import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRevealTrustedSealedWriterReader} from '../supabase/functions/xoxo-reveal-upload/trusted-writer-supabase-reader.mjs';
const ctx={attemptId:'a',senderId:'s'};
function setup(row={id:'a',sender_id:'s',status:'pending',writer_state:'sealed'}){
 const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:row,error:null})};
 return createRevealTrustedSealedWriterReader({dbClient:{from:()=>q}});
}
test('sealed pending writer is eligible for further finalization checks',async()=>{
 assert.equal((await setup()(ctx)).safeForFinalize,true);
});
test('active, idle and completed writers cannot pass',async()=>{
 for(const patch of [{writer_state:'writing'},{writer_state:'idle'},{status:'completed'}]){
  const read=setup({id:'a',sender_id:'s',status:'pending',writer_state:'sealed',...patch});
  assert.equal((await read(ctx)).safeForFinalize,false);
 }
});
test('mismatched or missing DB evidence fails closed',async()=>{
 for(const row of [null,{id:'wrong',sender_id:'s',status:'pending',writer_state:'sealed'}]){
  await assert.rejects(()=>setup(row)(ctx),/unavailable/);
 }
});
test('finalize SQL requires sealed writer under locked attempt',()=>{
 const sql=readFileSync(new URL('../supabase/migrations/20261019_xoxo_reveal_finalize_upload_v2_REVIEW_ONLY.sql',import.meta.url),'utf8');
 assert.match(sql,/FOR UPDATE/);
 assert.match(sql,/v_attempt\.writer_state IS DISTINCT FROM 'sealed'/);
});
