import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const audit = readFileSync(new URL("../scripts/audit-search-state.cjs", import.meta.url), "utf8");

test("the complete search matrix is a reproducible release command", () => {
  assert.equal(packageJson.scripts["audit:search"], "node scripts/audit-search-state.cjs");
  assert.ok(packageJson.devDependencies.playwright, "the audit browser is installed with the project");
});

test("the matrix covers every search world and critical responsive search state", () => {
  for (const route of ["home", "vacation-results", "vacation-region", "spa", "spa-region", "events", "hourly"]) {
    assert.match(audit, new RegExp(`\\["${route}"`));
  }
  for (const check of ["mobile-fresh", "guests-open", "guests-close-x", "guests-toggle-close", "desktop-after-mobile", "desktop-reload", "mobile-return"]) {
    assert.match(audit, new RegExp(`"${check}"`));
  }
  assert.match(audit, /blank-page/);
  assert.match(audit, /horizontal-viewport-drift/);
  assert.match(audit, /stale-mobile-scroll-lock/);
  assert.match(audit, /search-action-not-visible/);
});
