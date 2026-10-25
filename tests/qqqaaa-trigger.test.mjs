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
});

test("QQQAAA retains every broad VII suite and the approved exclusions", () => {
  for (const suite of ["test", "qa:regression-guards", "audit:search", "audit:availability", "qa:icon-geometry", "qa:site", "qa:production"]) {
    assert.match(runner, new RegExp(suite.replaceAll(":", "\\:")));
  }
  assert.match(runner, /exclusions: \["accessibility", "typography"\]/);
});
