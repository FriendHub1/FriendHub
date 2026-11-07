import test from "node:test";
import assert from "node:assert/strict";
import { revealCors, revealPreflight } from "../supabase/functions/xoxo-reveal-media-v2/cors.mjs";
const origin="https://www.xoxoavenue.com";
test("allowed origin receives 204 preflight with required headers",()=>{
  const r=revealPreflight(origin,origin);
  assert.equal(r.status,204);
  assert.equal(r.headers.get("access-control-allow-origin"),origin);
  assert.match(r.headers.get("access-control-allow-headers"),/authorization/);
  assert.match(r.headers.get("access-control-allow-headers"),/range/);
});
test("untrusted origins never receive CORS permissions",()=>{
  const r=revealPreflight("https://evil.example",origin);
  assert.equal(r.status,403);
  assert.equal(r.headers.get("access-control-allow-origin"),null);
  assert.equal(revealCors(null,origin),null);
});
test("allowed response exposes content-range for image loader",()=>{
  const headers=revealCors(origin,origin);
  assert.match(headers["access-control-expose-headers"],/content-range/);
  assert.equal(headers["access-control-allow-credentials"],undefined);
});
