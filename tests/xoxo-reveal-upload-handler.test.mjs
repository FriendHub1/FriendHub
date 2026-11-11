import test from "node:test";
import assert from "node:assert/strict";
import {handleRevealUpload} from "../supabase/functions/xoxo-reveal-upload/upload-handler.mjs";
const photo=()=>{const b=new Uint8Array(40);b.set([82,73,70,70]);b.set([87,69,66,80],8);return b;};
function fixture({allow=true,failLink=false}={}) {
  const events=[];
  const input={
    authenticatedSenderId:"sender",recipientId:"recipient",bytes:photo(),
    claimedType:"image/webp",mode:"timed",seconds:10,
    authorizeDm:async()=>{events.push("authorize");return allow;},
    generateObjectPath:()=>{events.push("path");return "reveal/random.webp";},
    createPrivateObject:async()=>{events.push("upload");},
    createLinkedMessage:async()=>{events.push("link");if(failLink)throw new Error("DB failed");
      return {revealId:"r",dmId:"d"};},
    deletePrivateObject:async()=>{events.push("cleanup");}
  };
  return {input,events};
}
test("checks authorization before private storage and returns only IDs",async()=>{
 const {input,events}=fixture();
 assert.deepEqual(await handleRevealUpload(input),{revealId:"r",dmId:"d"});
 assert.deepEqual(events,["authorize","path","upload","link"]);
});
test("unauthorized sender never uploads",async()=>{
 const {input,events}=fixture({allow:false});
 await assert.rejects(handleRevealUpload(input),/not authorized/);
 assert.deepEqual(events,["authorize"]);
});
test("database failure cleans uploaded private object",async()=>{
 const {input,events}=fixture({failLink:true});
 await assert.rejects(handleRevealUpload(input),/DB failed/);
 assert.deepEqual(events,["authorize","path","upload","link","cleanup"]);
});
test("invalid media is rejected before authorization or storage",async()=>{
 const {input,events}=fixture();input.bytes=new Uint8Array(40);
 await assert.rejects(handleRevealUpload(input),/Unsupported/);
 assert.deepEqual(events,[]);
});
