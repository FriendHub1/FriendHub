import test from "node:test";
import assert from "node:assert/strict";
import {inspectRevealUpload,MAX_IMAGE_BYTES} from "../supabase/functions/xoxo-reveal-upload/upload-policy.mjs";
const sender="sender",recipient="recipient";
const photo=()=>{const b=new Uint8Array(40);b.set([82,73,70,70],0);b.set([87,69,66,80],8);return b;};
const check=(bytes,claimedType="image/webp",extra={})=>inspectRevealUpload({bytes,claimedType,senderId:sender,recipientId:recipient,mode:"timed",seconds:10,...extra});
test("accepts small WebP with matching signature and duration",()=>{
  assert.deepEqual(check(photo()),{mediaType:"image",mime:"image/webp",bytes:40,mode:"timed",durationSeconds:10});
});
test("rejects MIME spoofing and unsupported formats",()=>{
  assert.throws(()=>check(new Uint8Array(40)),/Unsupported/);
  assert.throws(()=>check(photo(),"video/mp4"),/Unsupported/);
});
test("rejects oversized images and invalid recipients",()=>{
  const b=new Uint8Array(MAX_IMAGE_BYTES+1);b.set(photo());
  assert.throws(()=>check(b),/oversized/);
  assert.throws(()=>check(photo(),"image/webp",{recipientId:sender}),/participants/);
});
test("rejects invalid duration",()=>{
  assert.throws(()=>check(photo(),"image/webp",{seconds:9}),/duration/);
});
