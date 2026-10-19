import test from "node:test";
import assert from "node:assert/strict";
import {handleRevealHttpRequest} from "../supabase/functions/xoxo-reveal-upload/http-handler.mjs";
const origin="https://www.xoxoavenue.com";
const photo=()=>{const b=new Uint8Array(40);b.set([82,73,70,70]);b.set([87,69,66,80],8);return b;};
function fixture(){
 const events=[];
 const deps={allowedOrigin:origin,
  authClient:{auth:{getUser:async()=>{events.push("auth");return {data:{user:{id:"verified"}},error:null};}}},
  authorizeDm:async()=>{events.push("permission");return true;},
  generateObjectPath:()=>{events.push("path");return "private/test.webp";},
  createPrivateObject:async()=>{events.push("storage");},
  createLinkedMessage:async()=>{events.push("link");return {revealId:"r",dmId:"d"};},
  deletePrivateObject:async()=>{events.push("cleanup");}
 };
 const request=(headers={})=>new Request("https://example.test/upload",{method:"POST",
  headers:{origin,authorization:"Bearer mock.jwt.token","content-type":"image/webp",
   "x-reveal-recipient":"recipient","x-reveal-mode":"once",...headers},body:photo()});
 return {deps,request,events};
}
test("valid request passes through auth, permission and private storage",async()=>{
 const {deps,request,events}=fixture();
 const response=await handleRevealHttpRequest(request(),deps);
 assert.equal(response.status,201);
 assert.deepEqual(await response.json(),{revealId:"r",dmId:"d"});
 assert.deepEqual(events,["auth","permission","path","storage","link"]);
});
test("preflight from allowed origin never touches auth or storage",async()=>{
 const {deps,events}=fixture();
 const response=await handleRevealHttpRequest(new Request("https://example.test/upload",{
   method:"OPTIONS",headers:{origin,"access-control-request-method":"POST"}
 }),deps);
 assert.equal(response.status,204);
 assert.equal(events.length,0);
});
test("foreign origin denied before auth and storage",async()=>{
 const {deps,request,events}=fixture();
 const response=await handleRevealHttpRequest(request({origin:"https://evil.example"}),deps);
 assert.equal(response.status,403);
 assert.deepEqual(events,[]);
});
test("backend errors do not leak internal details",async()=>{
 const {deps,request}=fixture();
 deps.createPrivateObject=async()=>{throw new Error("SECRET_SERVICE_ROLE_KEY");};
 const response=await handleRevealHttpRequest(request(),deps);
 assert.equal(response.status,403);
 assert.doesNotMatch(await response.text(),/SECRET_SERVICE_ROLE_KEY/);
});
