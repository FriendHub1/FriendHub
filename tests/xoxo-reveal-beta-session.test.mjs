import test from "node:test";
import assert from "node:assert/strict";
import { createRevealBetaSession } from "../xoxo-reveal-beta-session.mjs";
const expiry = "2099-01-01T00:00:00.000Z";
function fixture() {
  const calls=[];
  const client={rpc:async(name,args)=>{
    calls.push(name);
    return {data:[name==="xoxo_reveal_prepare_v1"?
      {preparation_id:"p",prepare_until:expiry}:
      {session_id:"s",active_until:expiry}],error:null};
  }};
  const session=createRevealBetaSession({
    client,
    fetchMedia:async()=>{calls.push("fetch");return {dispose(){calls.push("dispose");}};},
    now:()=>Date.parse("2026-10-19T00:00:00Z"),
    schedule:()=>1,cancel:()=>{}
  });
  return {session,calls};
}
test("does not contact RPC or media before 100 percent",async()=>{
  const {session,calls}=fixture();
  session.slide(75);
  assert.equal(await session.releaseAndPrepare("r"),false);
  assert.deepEqual(calls,[]);
});
test("prepare only contacts RPC; start must precede media",async()=>{
  const {session,calls}=fixture();
  session.slide(100);
  assert.equal(await session.releaseAndPrepare("r"),true);
  assert.deepEqual(calls,["xoxo_reveal_prepare_v1"]);
  assert.equal(await session.startViewing(),true);
  assert.deepEqual(calls,["xoxo_reveal_prepare_v1","xoxo_reveal_start_v1","fetch"]);
  session.close();
  assert.equal(calls.at(-1),"dispose");
});
test("private loader must be supplied",()=>{
  assert.throws(()=>createRevealBetaSession({client:{rpc:async()=>({})}}),/Private media loader/);
});
