"use strict";
/* Static CI isolation contract: no safety test may quietly connect to or
 * deploy XOXO Avenue production infrastructure.
 * This complements, but does not replace, disposable PostgreSQL HTTP tests.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const ci = fs.readFileSync(path.join(root, ".github/workflows/xoxo-safety-beta-tests.yml"), "utf8");
const http = fs.readFileSync(path.join(__dirname, "test-safety-postgrest-http.py"), "utf8");
const seed = fs.readFileSync(path.join(__dirname, "sql-test-postgrest-fixtures.sql"), "utf8");
for (const [name, match] of [
  ["disposable DB", /PGDATABASE:\s*xoxo_safety_test/],
  ["PostgreSQL 17", /image: postgres:17/],
  ["loopback PostgreSQL host", /PGHOST:\s*127\.0\.0\.1/],
  ["PostgREST loopback binding", /PGRST_SERVER_HOST="127\.0\.0\.1"/],
  ["local-only JWT secret", /xoxo-local-ci-jwt-secret-not-for-production/],
  ["PostgREST fixed version", /postgrest\/postgrest:v12\.2\.12/],
  ["local HTTP integration test", /python3 beta\/test-safety-postgrest-http\.py/],
  ["ephemeral PostgREST cleanup", /docker rm -f xoxo-safety-ci-postgrest/]
]) assert.match(ci, match, "CI safety invariant missing: " + name);
assert.match(http, /HOST = "http:\/\/127\.0\.0\.1:3001"/);
assert.match(http, /assert os\.environ\.get\("PGDATABASE"\) == "xoxo_safety_test"/);
assert.match(seed, /current_database\(\) <> 'xoxo_safety_test'/);
for (const [name, contents] of [["workflow", ci], ["HTTP test", http]]) {
  assert.doesNotMatch(contents, /SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY|SUPABASE_DB_PASSWORD/,
    name + " must never depend on live Supabase secrets");
  assert.doesNotMatch(contents, /\bwrangler\s+deploy\b|\bsupabase\s+db\s+push\b|\bapply_migration\b/i,
    name + " must never deploy production schema or Workers");
}
console.log("PASS: disposable PostgreSQL and loopback-only PostgREST CI isolation");
