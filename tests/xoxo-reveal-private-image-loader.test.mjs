import test from "node:test";
import assert from "node:assert/strict";
import {createRevealImageLoader} from "../xoxo-reveal-private-image-loader.mjs";
function setup(size=12){
  const calls=[],data=new Uint8Array(size).map((_,i)=>i%256);
  let revoked=0;
  const loader=createRevealImageLoader({
    requestRange:async ({start,end,...ids})=>{
      calls.push({start,end,...ids});
      const last=Math.min(end,size-1);
      return {status:206,bytes:data.slice(start,last+1),contentRange:`bytes ${start}-${last}/${size}`};
    },
    createObjectURL:()=> "blob:test",revokeObjectURL:()=>{revoked++;}
  });
  return {loader,calls,get revoked(){return revoked;}};
}
test("fetches no bytes before caller invokes loader",async()=>{
  const x=setup();assert.equal(x.calls.length,0);
});
test("loads image in bounded authenticated ranges and revokes object URL",async()=>{
  const x=setup(300000);
  const media=await x.loader("r",{session_id:"s"});
  assert.equal(media.kind,"image");
  assert.ok(x.calls.length>=3);
  assert.ok(x.calls.every(c=>c.sessionId==="s"));
  media.dispose();media.dispose();assert.equal(x.revoked,1);
});
test("rejects oversized images before requesting remaining bytes",async()=>{
  const x=setup(900*1024+1);
  await assert.rejects(x.loader("r",{session_id:"s"}),/exceeds image budget/);
  assert.equal(x.calls.length,1);
});
test("rejects invalid media responses",async()=>{
  const loader=createRevealImageLoader({
    requestRange:async()=>({status:200}),createObjectURL:()=>"",revokeObjectURL:()=>{}
  });
  await assert.rejects(loader("r",{session_id:"s"}),/Invalid private media response/);
});
