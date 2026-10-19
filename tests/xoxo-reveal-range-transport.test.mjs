import test from "node:test";
import assert from "node:assert/strict";
import {createRevealRangeTransport} from "../xoxo-reveal-range-transport.mjs";

test("authenticated bounded GET uses exact range and no cache",async()=>{
  let request;
  const transport=createRevealRangeTransport({
    endpoint:"https://example.test/functions/v1/xoxo-reveal-media-v2",
    getAccessToken:async()=>"token",
    fetchImpl:async(url,init)=>{
      request={url,init};
      return {status:206,headers:new Headers({"content-range":"bytes 0-2/3"}),
        arrayBuffer:async()=>new Uint8Array([1,2,3]).buffer};
    }
  });
  const result=await transport({revealId:"r",sessionId:"s",start:0,end:2});
  assert.equal(result.bytes.length,3);
  assert.equal(request.init.headers.Range,"bytes=0-2");
  assert.equal(request.init.cache,"no-store");
  assert.equal(request.init.credentials,"omit");
  assert.equal(new URL(request.url).searchParams.get("session_id"),"s");
});
test("invalid range is rejected before network call",async()=>{
  const transport=createRevealRangeTransport({endpoint:"https://example.test/x",getAccessToken:async()=>"token",
    fetchImpl:async()=>{throw new Error("Should not fetch");}});
  await assert.rejects(transport({revealId:"r",sessionId:"s",start:0,end:1048576}),/Invalid range/);
});
test("unauthorized response cannot become media bytes",async()=>{
  const transport=createRevealRangeTransport({endpoint:"https://example.test/x",getAccessToken:async()=>"token",
    fetchImpl:async()=>({status:403})});
  await assert.rejects(transport({revealId:"r",sessionId:"s",start:0,end:0}),/Media unavailable/);
});
