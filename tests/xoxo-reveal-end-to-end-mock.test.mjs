import test from "node:test";
import assert from "node:assert/strict";
import { createRevealBetaSession } from "../xoxo-reveal-beta-session.mjs";
import { createRevealImageLoader } from "../xoxo-reveal-private-image-loader.mjs";
import { createRevealRangeTransport } from "../xoxo-reveal-range-transport.mjs";

const make = () => {
  const events=[];
  let time=Date.parse("2026-10-19T12:00:00Z");
  let timer;
  let revoked=0;
  const image=new Uint8Array(512).map((_,i)=>i%256);
  const client={rpc:async(name,args)=>{
    events.push(name);
    if(name==="xoxo_reveal_prepare_v1")return {data:[{preparation_id:"p",prepare_until:new Date(time+30000).toISOString()}],error:null};
    if(name==="xoxo_reveal_start_v1")return {data:[{session_id:"s",active_until:new Date(time+5000).toISOString()}],error:null};
    throw new Error("Unexpected RPC");
  }};
  const transport=createRevealRangeTransport({
    endpoint:"https://example.test/functions/v1/xoxo-reveal-media-v2",
    getAccessToken:async()=>"mock-jwt",
    fetchImpl:async(url,options)=>{
      events.push("range");
      assert.equal(options.headers.Authorization,"Bearer mock-jwt");
      const m=/bytes=(\d+)-(\d+)/.exec(options.headers.Range);
      const start=Number(m[1]),end=Math.min(Number(m[2]),image.length-1);
      return {status:206,headers:new Headers({"content-range":`bytes ${start}-${end}/${image.length}`}),
        arrayBuffer:async()=>image.slice(start,end+1).buffer};
    }
  });
  const loader=createRevealImageLoader({requestRange:transport,
    createObjectURL:()=> "blob:mock-photo",
    revokeObjectURL:()=>{revoked++;}});
  const session=createRevealBetaSession({client,fetchMedia:loader,
    now:()=>time,schedule:fn=>{timer=fn;return 1;},cancel:()=>{},
    onState:state=>events.push(state)});
  return {session,events,advance:ms=>{time+=ms;timer?.();},get revoked(){return revoked;}};
};

test("full simulated image flow: slide, prepare, start, range fetch, expire",async()=>{
  const x=make();
  x.session.slide(90);
  assert.equal(await x.session.releaseAndPrepare("reveal"),false);
  assert.equal(x.events.length,0);
  x.session.slide(100);
  assert.equal(await x.session.releaseAndPrepare("reveal"),true);
  assert.equal(x.events.includes("range"),false);
  assert.equal(await x.session.startViewing(),true);
  assert.equal(x.session.state,"viewing");
  const start=x.events.indexOf("xoxo_reveal_start_v1");
  const fetch=x.events.indexOf("range");
  assert.ok(start>=0 && fetch>start);
  x.advance(5001);
  assert.equal(x.session.state,"expired");
  assert.equal(x.revoked,1);
});

test("closing the simulated photo revokes the object URL once",async()=>{
  const x=make();x.session.slide(100);
  await x.session.releaseAndPrepare("reveal");
  await x.session.startViewing();
  x.session.close();x.session.close();
  assert.equal(x.revoked,1);
});
