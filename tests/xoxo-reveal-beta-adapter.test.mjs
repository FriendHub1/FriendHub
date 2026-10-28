import test from "node:test";
import assert from "node:assert/strict";
import { createRevealAdapter } from "../xoxo-reveal-beta-adapter.mjs";

test("preparation and start call separate RPCs with correct arguments", async () => {
  const calls=[];
  const client={rpc:async(name,args)=>{calls.push({name,args});return {data:[name.endsWith("prepare_v1")?
    {preparation_id:"p",prepare_until:"2099-01-01T00:00:00Z"}:
    {session_id:"s",active_until:"2099-01-01T00:00:00Z"}],error:null};}};
  const adapter=createRevealAdapter(client);
  assert.equal((await adapter.prepare("r")).preparation_id,"p");
  assert.equal((await adapter.start("r","p")).session_id,"s");
  assert.deepEqual(calls,[
    {name:"xoxo_reveal_prepare_v1",args:{p_reveal_id:"r"}},
    {name:"xoxo_reveal_start_v1",args:{p_reveal_id:"r",p_preparation_id:"p"}}
  ]);
});
test("backend errors stop the flow", async () => {
  const adapter=createRevealAdapter({rpc:async()=>({error:{message:"Forbidden"}})});
  await assert.rejects(adapter.prepare("r"),/Forbidden/);
});
test("empty backend result is rejected", async () => {
  const adapter=createRevealAdapter({rpc:async()=>({data:[],error:null})});
  await assert.rejects(adapter.prepare("r"),/Empty result/);
});
