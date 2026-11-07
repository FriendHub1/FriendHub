import test from "node:test";
import assert from "node:assert/strict";
import {assessIsolatedPostgresTarget as check} from "./xoxo-reveal-postgres-target-preflight.mjs";
const environment="isolated-test";
test("accepts dedicated local test DB target",()=>{
 assert.equal(check({environment,url:"postgresql://tester@127.0.0.1:5432/xoxo_reveal_test_ci"}).allowed,true);
});
test("rejects remote Supabase database URLs",()=>{
 assert.equal(check({environment,url:"postgresql://tester@db.example.supabase.co:5432/xoxo_reveal_test_ci"}).allowed,false);
});
test("rejects production-looking local database names",()=>{
 assert.equal(check({environment,url:"postgresql://tester@localhost:5432/postgres"}).allowed,false);
});
test("requires explicit isolated environment",()=>{
 assert.equal(check({url:"postgresql://tester@localhost/xoxo_reveal_test_ci",environment:"production"}).allowed,false);
});
test("rejects non-postgres schemes and URL options",()=>{
 assert.equal(check({environment,url:"https://localhost/xoxo_reveal_test_ci"}).allowed,false);
 assert.equal(check({environment,url:"postgresql://localhost/xoxo_reveal_test_ci?host=db.remote"}).allowed,false);
});
