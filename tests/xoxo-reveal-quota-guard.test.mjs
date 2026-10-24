import test from "node:test";
import assert from "node:assert/strict";
import {processQuotaProtectedRevealUpload} from "../supabase/functions/xoxo-reveal-upload/quota-guard.mjs";
const photo=()=>{const b=new Uint8Array(40);b.set([82,73,70,70]);b.set([87,69,66,80],8);return b;};
function fixture(){
 const calls=[];
 const opts={
  authorization:"Bearer mock.jwt.token",
  authClient:{auth:{getUser:async()=>{calls.push("verify");return {data:{user:{id:"verified"}},error:null};}}},
  bytes:photo(),recipientId:"recipient",claimedType:"image/webp",mode:"once",seconds:null,
  reserveQuota:async({senderId,bytes})=>{calls.push("reserve:"+senderId+":"+bytes);return {allowed:true,id:"reservation-1"};},
  releaseQuota:async({reservationId})=>{calls.push("refund:"+reservationId);},
  authorizeDm:async()=>{calls.push("authorize");return true;},
  generateObjectPath:()=>{calls.push("path");return "private/random.webp";},
  createPrivateObject:async()=>{calls.push("upload");},
  createLinkedMessage:async()=>{calls.push("link");return {revealId:"r",dmId:"d"};},
  deletePrivateObject:async()=>{calls.push("cleanup");}
 };
 return {opts,calls};
}
test("reserves quota before storage and retains it on success",async()=>{
 const {opts,calls}=fixture();
 assert.deepEqual(await processQuotaProtectedRevealUpload(opts),{revealId:"r",dmId:"d"});
 assert.deepEqual(calls,["verify","reserve:verified:40","verify","authorize","path","upload","link"]);
});
test("quota denial prevents storage and DM creation",async()=>{
 const {opts,calls}=fixture();
 opts.reserveQuota=async()=>{calls.push("deny");return {allowed:false};};
 await assert.rejects(processQuotaProtectedRevealUpload(opts),/quota exceeded/);
 assert.deepEqual(calls,["verify","deny"]);
});
test("failed upload releases quota reservation",async()=>{
 const {opts,calls}=fixture();
 opts.createPrivateObject=async()=>{calls.push("failed-upload");throw new Error("storage down");};
 await assert.rejects(processQuotaProtectedRevealUpload(opts),/storage down/);
 assert.equal(calls.at(-1),"refund:reservation-1");
});
test("invalid authentication never reserves quota",async()=>{
 const {opts,calls}=fixture();
 opts.authClient={auth:{getUser:async()=>{calls.push("verify");return {data:{user:null},error:{message:"invalid"}};}}};
 await assert.rejects(processQuotaProtectedRevealUpload(opts),/Invalid authentication/);
 assert.deepEqual(calls,["verify"]);
});
