import test from "node:test";
import assert from "node:assert/strict";
import {processRevealUploadRequest} from "../supabase/functions/xoxo-reveal-upload/request-handler.mjs";
const photo=()=>{const b=new Uint8Array(40);b.set([82,73,70,70]);b.set([87,69,66,80],8);return b;};
function setup(valid=true){
 const calls=[];
 const deps={
   authorization:"Bearer mock.jwt.token",
   authClient:{auth:{getUser:async()=>{calls.push("verify");return valid?
     {data:{user:{id:"verified-sender"}},error:null}:{data:{user:null},error:{message:"expired"}};}}},
   recipientId:"recipient",bytes:photo(),claimedType:"image/webp",mode:"once",seconds:null,
   authorizeDm:async({senderId})=>{calls.push("authorize:"+senderId);return true;},
   generateObjectPath:()=>{calls.push("path");return "private/unique.webp";},
   createPrivateObject:async()=>{calls.push("upload");},
   createLinkedMessage:async({senderId})=>{calls.push("link:"+senderId);return {revealId:"r",dmId:"d"};},
   deletePrivateObject:async()=>{calls.push("cleanup");}
 };
 return {deps,calls};
}
test("verified identity is propagated to DM and upload authorization",async()=>{
 const {deps,calls}=setup();
 assert.deepEqual(await processRevealUploadRequest(deps),{revealId:"r",dmId:"d"});
 assert.deepEqual(calls,["verify","authorize:verified-sender","path","upload","link:verified-sender"]);
});
test("invalid JWT stops before any authorization or storage work",async()=>{
 const {deps,calls}=setup(false);
 await assert.rejects(processRevealUploadRequest(deps),/Invalid authentication/);
 assert.deepEqual(calls,["verify"]);
});
test("unauthorized DM stops before storage",async()=>{
 const {deps,calls}=setup();
 deps.authorizeDm=async()=>{calls.push("deny");return false;};
 await assert.rejects(processRevealUploadRequest(deps),/not authorized/);
 assert.deepEqual(calls,["verify","deny"]);
});
