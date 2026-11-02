const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const workerPath = path.join(__dirname, "..", "worker.js");
const source = fs.readFileSync(workerPath, "utf8");

test("shared-profile bootstrap is valid JavaScript and carries the resolved UUID", () => {
  const helper = source.match(/function buildProfileBootstrap\\(profileId\\) \\{[\\s\\S]*?\\n\\}/);
  assert.ok(helper, "buildProfileBootstrap(profileId) must exist");

  const buildProfileBootstrap = new Function(helper[0] + "; return buildProfileBootstrap;")();
  const profileId = "352e566e-7644-4bf4-86d1-883706aa1bac";
  const html = buildProfileBootstrap(profileId);
  const scriptMatch = html.match(/^<script[^>]*>([\\s\\S]*)<\\/script>$/);

  assert.ok(scriptMatch, "bootstrap must return a script element");
  assert.doesNotThrow(() => new vm.Script(scriptMatch[1]), "generated browser script must compile");
  assert.ok(scriptMatch[1].includes(profileId), "generated script must include the resolved profile UUID");
  assert.doesNotMatch(scriptMatch[1], /openPublicProfile\\s*\\(/, "bootstrap must not open the profile a second time");
});

test("loader is rendered by the Worker before the app can paint Home", () => {
  assert.match(source, /XOXO_PROFILE_LOADER_STYLE/);
  assert.match(source, /XOXO_PROFILE_LOADER_MARKUP/);
  assert.match(source, /element\\.prepend\\(XOXO_PROFILE_LOADER_MARKUP, \\{ html: true \\}\\)/);
  assert.match(source, /xoxo-profile-bootstrap-pending/);
  assert.match(source, /function profileIsReady\\(\\)/);
});
