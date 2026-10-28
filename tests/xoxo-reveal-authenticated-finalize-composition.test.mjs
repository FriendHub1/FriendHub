import test from 'node:test';
import assert from 'node:assert/strict';
import {createRevealVerifiedFinalizeWithAuthenticatedDm} from '../supabase/functions/xoxo-reveal-upload/verified-finalize-service.mjs';

test('authenticated finalize composition requires request-bound Auth client',()=>{
 assert.throws(()=>createRevealVerifiedFinalizeWithAuthenticatedDm({
  dbClient:{from(){}},storageClient:{},rpcClient:{},sha256:async()=>'',maxBytes:1024
 }),/Trusted authentication client required/);
});
test('authenticated finalize composition requires privileged DB client',()=>{
 assert.throws(()=>createRevealVerifiedFinalizeWithAuthenticatedDm({
  authClient:{auth:{getUser:async()=>({data:{user:null}})}},
  storageClient:{},rpcClient:{},sha256:async()=>'',maxBytes:1024
 }),/Privileged DM authorization database client required/);
});
