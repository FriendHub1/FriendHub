"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const read = name => fs.readFileSync(path.join(root,name), "utf8");
const beta = JSON.parse(read("wrangler.safety-beta.jsonc"));
const live = JSON.parse(read("wrangler.jsonc"));
assert.equal(beta.name, "xoxo-safety-beta");
assert.notEqual(beta.name, live.name, "BETA cannot overwrite the production Worker");
assert.equal(live.name, "friendhub");
assert.equal(beta.main, "./worker.js");
assert.equal(beta.workers_dev, true);
assert.equal(beta.assets.directory, "./.xoxo-safety-beta-dist");
assert.equal(beta.assets.binding, "ASSETS");
assert.equal(beta.assets.run_worker_first, true);
assert.equal(beta.vars.XOXO_ACTIVITY_EMAILS_ENABLED, "false");
for (const key of ["route","routes","zone_id","custom_domains","account_id","triggers"]) {
  assert.equal(Object.hasOwn(beta, key), false, "Forbidden BETA config key: " + key);
}
const workflow = read(".github/workflows/xoxo-safety-beta-deploy.yml");
assert.match(workflow, /feature\/xoxo-safety-reminder-beta/);
assert.match(workflow, /XOXO_SAFETY_BETA_DEPLOY_ENABLED: \$\{\{ vars\.XOXO_SAFETY_BETA_DEPLOY_ENABLED \}\}/);
assert.match(workflow, /test "\$XOXO_SAFETY_BETA_DEPLOY_ENABLED" = 'true'/);
assert.match(workflow, /secrets\.XOXO_SAFETY_BETA_CF_API_TOKEN/);
assert.match(workflow, /secrets\.XOXO_SAFETY_BETA_CF_ACCOUNT_ID/);
assert.match(workflow, /environment:\s*xoxo-safety-beta/);
for (const line of workflow.split("\n").filter(line=>/wrangler@.+ deploy /.test(line))) {
  assert.match(line, /--config \.\/wrangler\.safety-beta\.jsonc/);
  assert.doesNotMatch(line, /--name\s+friendhub/);
}
assert.match(workflow, /deploy --dry-run/);
assert.match(workflow, /on:\n  push:\n    branches:\n      - feature\/xoxo-safety-reminder-beta/);
const builder = read("beta/build-safety-beta-assets.sh");
for (const js of ["stay-safe-sweetheart.js","stay-safe-report-form.js",
  "stay-safe-evidence-picker.js","stay-safe-browser-report-adapter.js",
  "stay-safe-browser-flow.js","stay-safe-chat-preview-bridge.js",
  "admin-report-queue.js","admin-report-panel-bridge.js"]) {
  assert.ok(builder.includes(js), "Missing BETA asset script: "+js);
}
assert.match(builder, /Missing required BETA script/);
assert.match(builder, /unexpected private file in BETA public assets/);
console.log("PASS: isolated xoxo-safety-beta config and guarded deploy workflow");
