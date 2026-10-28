// Run with: node --test tests/xoxo-reveal-two-phase.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { RevealPlaybackController } from "../xoxo-reveal-two-phase-controller.mjs";

const prep={preparation_id:"p1",prepare_until:new Date(30000).toISOString()};
const session={session_id:"s1",active_until:new Date(10000).toISOString()};
const setup=(overrides={})=>{
  let now=0, calls=[],disposed=0, callback;
  const controller=new RevealPlaybackController({
    prepare:async()=>{calls.push("prepare");return prep;},
    start:async()=>{calls.push("start");return session;},
    fetchMedia:async()=>{calls.push("fetch");return {dispose(){disposed++;}};},
    now:()=>now,schedule:fn=>{callback=fn;return 1;},cancel:()=>{},
    ...overrides
  });
  return {controller,calls,clock:v=>{now=v;},tick:()=>callback?.(),get disposed(){return disposed;}};
};
test("slider must reach 100 percent; early release resets",async()=>{
  const x=setup();x.controller.slide(99);assert.equal(await x.controller.open("r"),false);
  assert.equal(x.controller.progress,0);assert.deepEqual(x.calls,[]);
});
test("preparation does not download media",async()=>{
  const x=setup();x.controller.slide(100);assert.equal(await x.controller.open("r"),true);
  assert.deepEqual(x.calls,["prepare"]);assert.equal(x.controller.state,"ready-to-start");
});
test("start precedes first media byte",async()=>{
  const x=setup();x.controller.slide(100);await x.controller.open("r");
  assert.equal(await x.controller.begin(),true);
  assert.deepEqual(x.calls,["prepare","start","fetch"]);
});
test("expired preparation cannot start",async()=>{
  const x=setup();x.controller.slide(100);await x.controller.open("r");
  x.clock(31000);assert.equal(await x.controller.begin(),false);
  assert.deepEqual(x.calls,["prepare"]);
});
test("expired session closes and disposes media",async()=>{
  const x=setup();x.controller.slide(100);await x.controller.open("r");await x.controller.begin();
  x.clock(10001);x.tick();assert.equal(x.controller.state,"expired");assert.equal(x.disposed,1);
});
test("closing during fetch prevents display",async()=>{
  let resolve;const x=setup({fetchMedia:()=>new Promise(r=>{resolve=r;})});
  x.controller.slide(100);await x.controller.open("r");
  const pending=x.controller.begin();await Promise.resolve();await Promise.resolve();
  x.controller.close();resolve({dispose(){}});
  assert.equal(await pending,false);assert.equal(x.controller.state,"closed");
});
