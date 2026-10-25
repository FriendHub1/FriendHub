"use strict";
/* Non-negotiable guard for experimental Supabase Auth issuer tests.
 * Verifies CI cannot address the user's real Supabase project or worker.
 */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const workflow=fs.readFileSync(path.join(__dirname,"..",
  ".github/workflows/xoxo-safety-gotrue-isolated.yml"),"utf8");
const harness=fs.readFileSync(path.join(__dirname,
  "test-safety-gotrue-auth-http.py"),"utf8");
const native=fs.readFileSync(path.join(__dirname,
  "test-safety-gotrue-native-session.py"),"utf8");
const nativeFixture=fs.readFileSync(path.join(__dirname,
  "sql-test-gotrue-native-session-fixture.sql"),"utf8");
for(const value of ["cxosofpxfmjkrhfabrqc","xoxoavenue.com",
  "supabase.co","service_role", "wrangler deploy", "supabase db push"]){
  assert.ok(!workflow.includes(value),"experimental workflow contains a forbidden target: "+value);
}
assert.match(workflow,/PGHOST:\s*127\.0\.0\.1/);
assert.match(workflow,/PGDATABASE:\s*xoxo_safety_test/);
assert.match(workflow,/GOTRUE_API_HOST=127\.0\.0\.1/);
assert.match(workflow,/PGRST_SERVER_HOST=127\.0\.0\.1/);
assert.match(workflow,/on:\s*\n\s*push:\s*\n\s*branches:/,
  "run only in the designated BETA branch");
assert.match(workflow,/alter role postgres in database xoxo_gotrue_ci set search_path = auth, public/);
assert.ok(workflow.indexOf("set search_path = auth, public") <
  workflow.indexOf("supabase/gotrue:v2.197.0 auth migrate"),
  "GoTrue's schema_migrations must be created in its startup search path");
assert.match(workflow,/Clean up disposable services even after failure/);
assert.match(workflow,/if: always\(\)/);
for(const url of ["http://127.0.0.1:9999","http://127.0.0.1:3001"])
  assert.ok(harness.includes(url),"harness must use isolated loopback: "+url);
assert.ok(!/cxosofpxfmjkrhfabrqc|https:\/\//.test(harness),
  "experimental token test must never connect to remote services");
assert.match(workflow,/PGRST_SERVER_PORT=3002/);
assert.match(workflow,/Verify real GoTrue-managed session and report RPC use same temporary database/);
assert.match(native,/http:\/\/127\.0\.0\.1:3002/);
assert.match(native,/from auth\.sessions where/);
assert.doesNotMatch(native,/(insert into|update) auth\.sessions/i,
  "native session test must read real GoTrue records rather than mirror them");
assert.match(nativeFixture,/current_database\(\) <> 'xoxo_gotrue_ci'/);
assert.doesNotMatch(nativeFixture,/create table auth\.(sessions|users)/i,
  "native fixture must preserve real GoTrue-managed Auth tables");
console.log("PASS: independent GoTrue issuer CI uses disposable PostgreSQL, loopback HTTP, fictional keys and consistent migrations");
