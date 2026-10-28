import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const [packageJson, runner] = await Promise.all([
  readFile(new URL("package.json", root), "utf8").then(JSON.parse),
  readFile(new URL("scripts/run-qqqaaa.cjs", root), "utf8"),
]);

test("QQQAAA has one durable aggregate package entry point", () => {
  assert.equal(packageJson.scripts["qa:qqqaaa"], "node scripts/run-qqqaaa.cjs");
  assert.match(runner, /trigger: "QQQAAA"/);
  assert.doesNotMatch(runner, /if \(result\.status !== 0\) break/);
  assert.match(runner, /report\.suites\.every\(\(suite\) => suite\.status === "passed"\)/);
  assert.match(runner, /process\.platform === "win32" \? "cmd\.exe" : "pnpm"/);
  assert.match(runner, /launchError:/);
  assert.match(runner, /stdio: "inherit"/);
  assert.match(runner, /await new Promise/);
  assert.doesNotMatch(runner, /spawnSync/);
});

test("QQQAAA retains every broad VII suite and the approved exclusions", () => {
  for (const suite of ["qa:auth-boundaries", "test", "qa:regression-guards", "audit:search", "audit:availability", "qa:icon-geometry", "qa:overlay-geometry", "qa:map", "qa:locales", "qa:responsive-transitions", "qa:site", "qa:production"]) {
    assert.match(runner, new RegExp(suite.replaceAll(":", "\\:")));
  }
  assert.match(runner, /exclusions: \["accessibility", "typography"\]/);
});

test("QQQAAA permanently guards flexible online-booking searches", () => {
  assert.match(runner, /flexible-online-search/);
  assert.match(runner, /qa:flexible-online-search/);
  assert.match(packageJson.scripts["qa:flexible-online-search"], /flexible-search-priority-contract\.test\.mjs/);
});

test("QQQAAA has an explicit administrator and customer identity boundary gate", () => {
  assert.match(runner, /admin-customer-auth-boundaries/);
  assert.match(packageJson.scripts["qa:auth-boundaries"], /auth-audience-separation\.test\.mjs/);
  assert.match(packageJson.scripts["qa:auth-boundaries"], /admin-server-gate\.test\.mjs/);
  assert.match(packageJson.scripts["qa:auth-boundaries"], /logout-route\.test\.mjs/);
  assert.match(packageJson.scripts["qa:auth-boundaries"], /account-frontend-contract\.test\.mjs/);
  assert.match(packageJson.scripts["qa:auth-boundaries"], /launch-seo\.test\.mjs/);
});

test("QQQAAA permanently guards the production repairs required before Professor", () => {
  assert.match(runner, /pre-professor-production-repairs/);
  const suite = packageJson.scripts["qa:pre-professor-repairs"];
  for (const file of ["booking-mode-contract.test.mjs", "vii-stay-calendar.test.mjs", "last-minute-page.test.mjs", "geography-missing-map-points.test.mjs", "legacy-gallery-media-independence.test.mjs"]) {
    assert.match(suite, new RegExp(file.replaceAll(".", "\\.")));
  }
});

test("QQQAAA observes supplier gallery names and every floating action family in production", () => {
  assert.match(runner, /vii-unified-19-public/);
  assert.match(packageJson.scripts["qa:vii-unified-19-public"], /audit-unified-19-public/);
});

test("QQQAAA guards stable navigation and complete room-scoped dated results", () => {
  assert.match(runner, /navigation-and-unit-results/);
  assert.match(packageJson.scripts["qa:navigation-unit-results"], /navigation-unit-results-regression\.test\.mjs/);
});
