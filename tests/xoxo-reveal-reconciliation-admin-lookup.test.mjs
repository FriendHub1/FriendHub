import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRevealReconciliationAdminLookup} from '../supabase/functions/xoxo-reveal-upload/reconciliation-admin-lookup.mjs';
test('admin lookup only accepts strict true from privileged RPC',async()=>{
 const calls=[];
 const lookup=createRevealReconciliationAdminLookup({rpcClient:{rpc:async(...args)=>{calls.push(args);return {data:true,error:null};}}});
 assert.equal(await lookup({userId:'u'}),true);
 assert.deepEqual(calls,[['xoxo_reveal_is_reconciliation_admin_v1',{p_user_id:'u'}]]);
});
test('errors, truthy objects and absent IDs deny access',async()=>{
 for(const response of [{data:{admin:true},error:null},{data:false,error:null},{data:true,error:{message:'denied'}}]){
  const lookup=createRevealReconciliationAdminLookup({rpcClient:{rpc:async()=>response}});
  assert.equal(await lookup({userId:'u'}),false);
 }
 const lookup=createRevealReconciliationAdminLookup({rpcClient:{rpc:async()=>{throw Error('down');}}});
 assert.equal(await lookup({userId:'u'}),false);
 assert.equal(await lookup({}),false);
});
test('review-only SQL denies all until actual admin membership is verified',()=>{
 const sql=readFileSync(new URL('../supabase/migrations/20261019_xoxo_reveal_reconciliation_admin_v1_REVIEW_ONLY.sql',import.meta.url),'utf8');
 assert.match(sql,/auth\.role\(\) IS DISTINCT FROM 'service_role'/);
 assert.match(sql,/RETURN false;/);
 assert.match(sql,/REVOKE ALL ON FUNCTION/);
 assert.match(sql,/RELEASE BLOCKER/);
});
