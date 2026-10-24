import test from 'node:test';
import assert from 'node:assert/strict';
import {createRevealTrustedRevealDmReader} from '../supabase/functions/xoxo-reveal-upload/trusted-reveal-dm-supabase-reader.mjs';
import {createRevealTrustedAttemptReader} from '../supabase/functions/xoxo-reveal-upload/trusted-attempt-supabase-reader.mjs';

test('malformed DM binding IDs never query private tables',async()=>{
 let reads=0,authorizations=0;
 const reader=createRevealTrustedRevealDmReader({
  dbClient:{from:()=>{reads++;throw new Error('unexpected');}},
  verifyDmAuthorization:async()=>{authorizations++;return true;}
 });
 for(const input of [
  {attemptId:' ',revealId:'reveal',dmId:'dm'},
  {attemptId:'attempt',revealId:'  ',dmId:'dm'},
  {attemptId:'attempt',revealId:'reveal',dmId:' '},
  {attemptId:'attempt',revealId:1,dmId:'dm'}
 ])
  await assert.rejects(reader(input),TypeError);
 assert.equal(reads,0);assert.equal(authorizations,0);
});
test('malformed attempt evidence IDs never query private tables',async()=>{
 let reads=0;
 const reader=createRevealTrustedAttemptReader({
  dbClient:{from:()=>{reads++;throw new Error('unexpected');}}
 });
 for(const input of [
  {attemptId:' ',senderId:'sender'},
  {attemptId:'attempt',senderId:'  '},
  {attemptId:5,senderId:'sender'}
 ])
  await assert.rejects(reader(input),TypeError);
 assert.equal(reads,0);
});
