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
const jsClient=fs.readFileSync(path.join(__dirname,
  "test-safety-native-js-client.cjs"),"utf8");
const browser=fs.readFileSync(path.join(__dirname,
  "test-safety-native-browser-e2e.cjs"),"utf8");
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
assert.match(workflow,/Verify native GoTrue session and actual JavaScript submission pipeline in same disposable database/);
assert.match(workflow,/node-version:\s*"22"/);
assert.match(workflow,/beta\/test-safety-native-js-client\.cjs/);
assert.match(workflow,/beta\/test-safety-native-browser-e2e\.cjs/);
assert.match(workflow,/Install pinned WebKit and Chromium for isolated real-browser reports/);
assert.match(workflow,/Verify native GoTrue, moderator role, PIN and audited RPCs without browser downloads/);
assert.match(workflow,/XOXO_SAFETY_NATIVE_QUICK_ADMIN:\s*"1"/);
assert.match(workflow,/NODE_PATH:\s*\$\{\{ runner\.temp \}\}\/xoxo-safety-playwright\/node_modules/);
assert.match(native,/http:\/\/127\.0\.0\.1:3002/);
assert.match(native,/js_report_pipeline\("active",token,outsider_token,message,user,outsider_user\)/);
assert.match(native,/js_report_pipeline\("revoked",token,outsider_token,message,user,outsider_user\)/);
assert.match(native,/real_browser_report_flow\(token,message,user\)/);
assert.match(native,/native_admin_moderation_queue\(token,outsider_token,outsider_user,/);
assert.match(native,/reports_before=int\(db\(/);
assert.match(native,/reports_before\+1/);
assert.match(native,/xoxo_admin_list_conversation_reports_beta/);
assert.match(native,/xoxo_admin_update_conversation_report_beta/);
assert.match(native,/xoxo_admin_page_conversation_reports_beta/);
assert.match(native,/verified_until=now\(\)-interval '1 minute'/);
assert.match(native,/delete from public\.direct_messages where id=/);
assert.match(native,/Deleted evidence was accepted as a new conversation report/);
assert.match(native,/Deleted DM changed the already committed report receipt/);
assert.match(jsClient,/require\("\.\/submit-conversation-report-beta\.cjs"\)/);
assert.match(jsClient,/require\("\.\/stay-safe-browser-report-adapter\.js"\)/);
assert.match(jsClient,/require\("\.\/stay-safe-browser-flow\.js"\)/);
assert.match(jsClient,/enabled:true,previewOnly:false/);
assert.match(jsClient,/flow\.showReminder\(\)/);
assert.match(jsClient,/http:\/\/127\.0\.0\.1:9999/);
assert.match(jsClient,/http:\/\/127\.0\.0\.1:3002/);
assert.doesNotMatch(jsClient,/cxosofpxfmjkrhfabrqc|xoxoavenue\.com|supabase\.co|https:\/\//i,
  "real-JS Auth/RLS harness may contact only isolated loopback services");
for(const route of ["http://127.0.0.1:9999/user","http://127.0.0.1:3002"])
  assert.ok(browser.includes(route),"live browser proxy must target "+route);
assert.match(browser,/require\("playwright"\)/);
assert.match(browser,/\.addScriptTag\(/);
assert.doesNotMatch(browser,/cxosofpxfmjkrhfabrqc|xoxoavenue\.com|supabase\.co|https:\/\//i,
  "browser integration must never address production or external servers");
assert.match(native,/from auth\.sessions where/);
assert.doesNotMatch(native,/(insert into|update) auth\.sessions/i,
  "native session test must read real GoTrue records rather than mirror them");
assert.match(nativeFixture,/current_database\(\) <> 'xoxo_gotrue_ci'/);
assert.doesNotMatch(nativeFixture,/create table auth\.(sessions|users)/i,
  "native fixture must preserve real GoTrue-managed Auth tables");
console.log("PASS: independent GoTrue issuer CI uses disposable PostgreSQL, loopback HTTP, fictional keys and consistent migrations");
