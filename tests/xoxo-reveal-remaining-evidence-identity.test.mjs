import test from 'node:test';
import assert from 'node:assert/strict';
import {createRevealTrustedQuotaReader} from '../supabase/functions/xoxo-reveal-upload/trusted-quota-supabase-reader.mjs';
import {createRevealTrustedObjectBindingReader} from '../supabase/functions/xoxo-reveal-upload/trusted-object-binding-supabase-reader.mjs';
import {createRevealTrustedWriterReader} from '../supabase/functions/xoxo-reveal-upload/trusted-writer-supabase-reader.mjs';

test('invalid quota IDs never query reservation rows',async()=>{
 let reads=0;
 const read=createRevealTrustedQuotaReader({dbClient:{from:()=>{reads++;throw Error('unexpected');}}});
 for(const input of [{attemptId:' ',senderId:'sender'},{attemptId:'attempt',senderId:' '}])
  await assert.rejects(read(input),TypeError);
 assert.equal(reads,0);
});
test('invalid object binding ID never queries stored digest',async()=>{
 let reads=0;
 const read=createRevealTrustedObjectBindingReader({dbClient:{from:()=>{reads++;throw Error('unexpected');}}});
 await assert.rejects(read({attemptId:'  '}),TypeError);
 assert.equal(reads,0);
});
test('invalid writer IDs never invoke trusted fence',async()=>{
 let checks=0;
 const read=createRevealTrustedWriterReader({verifyWriterFence:async()=>{checks++;throw Error('unexpected');}});
 for(const input of [{attemptId:' ',senderId:'sender'},{attemptId:'attempt',senderId:' '}])
  await assert.rejects(read(input),TypeError);
 assert.equal(checks,0);
});
