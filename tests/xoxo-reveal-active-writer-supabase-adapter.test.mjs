import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRevealActiveWriterSupabaseAuthorizer} from '../supabase/functions/xoxo-reveal-upload/active-writer-supabase-adapter.mjs';
test('authorized writer RPC uses exact server-side identity',async()=>{
 const calls=[];
 const authorize=createRevealActiveWriterSupabaseAuthorizer({rpcClient:{rpc:async(...args)=>{calls.push(args);return {data:true,error:null};}}});
 assert.equal(await authorize({attemptId:'a',senderId:'s',writerToken:'t'}),true);
 assert.deepEqual(calls[0],['xoxo_reveal_verify_active_writer_v2',{p_attempt_id:'a',p_sender_id:'s',p_writer_token:'t'}]);
});
test('RPC errors, non-boolean responses and missing tokens fail closed',async()=>{
 for(const response of [{data:null,error:null},{data:false,error:null},{data:true,error:{message:'down'}}]){
  const authorize=createRevealActiveWriterSupabaseAuthorizer({rpcClient:{rpc:async()=>response}});
  assert.equal(await authorize({attemptId:'a',senderId:'s',writerToken:'t'}),false);
  assert.equal(await authorize({attemptId:'a',senderId:'s'}),false);
 }
});
test('SQL RPC restricts execution and requires active writing state',()=>{
 const sql=readFileSync(new URL('../supabase/migrations/20261019_xoxo_reveal_active_writer_v2_REVIEW_ONLY.sql',import.meta.url),'utf8');
 assert.match(sql,/auth\.role\(\) IS DISTINCT FROM 'service_role'/);
 assert.match(sql,/writer_state='writing'/);
 assert.match(sql,/claim_token IS NOT DISTINCT FROM p_writer_token/);
 assert.match(sql,/REVOKE ALL ON FUNCTION/);
 assert.match(sql,/FOR UPDATE/);
});
