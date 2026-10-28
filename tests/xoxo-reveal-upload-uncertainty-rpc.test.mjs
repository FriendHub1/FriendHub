import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRevealUploadUncertaintyRpcMarker} from '../supabase/functions/xoxo-reveal-upload/upload-uncertainty-rpc-adapter.mjs';
test('uncertain upload is marked through privileged RPC',async()=>{
 const calls=[];
 const mark=createRevealUploadUncertaintyRpcMarker({rpcClient:{rpc:async(...args)=>{calls.push(args);return {data:true,error:null};}}});
 assert.equal(await mark({attemptId:'a',senderId:'s'}),true);
 assert.deepEqual(calls[0],['xoxo_reveal_mark_upload_uncertain_v1',{p_attempt_id:'a',p_sender_id:'s',p_reason:'upload_outcome_uncertain'}]);
});
test('marker errors and non-true responses fail closed',async()=>{
 for(const response of [{data:false,error:null},{data:null,error:null},{data:true,error:{message:'down'}}]){
  const mark=createRevealUploadUncertaintyRpcMarker({rpcClient:{rpc:async()=>response}});
  await assert.rejects(()=>mark({attemptId:'a',senderId:'s'}),/rejected/);
 }
});
test('SQL marker is service-only and persists first uncertainty reason',()=>{
 const sql=readFileSync(new URL('../supabase/migrations/20261019_xoxo_reveal_upload_uncertainty_v1_REVIEW_ONLY.sql',import.meta.url),'utf8');
 assert.match(sql,/auth\.role\(\) IS DISTINCT FROM 'service_role'/);
 assert.match(sql,/FOR UPDATE/);
 assert.match(sql,/COALESCE\(upload_uncertain_at,clock_timestamp\(\)\)/);
 assert.match(sql,/REVOKE ALL ON FUNCTION/);
});
