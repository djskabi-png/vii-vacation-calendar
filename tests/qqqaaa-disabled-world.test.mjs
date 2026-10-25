import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const mapAudit = readFileSync(new URL("../scripts/audit-map-experience.cjs", import.meta.url), "utf8");
const responsiveAudit = readFileSync(new URL("../scripts/audit-responsive-transitions.cjs", import.meta.url), "utf8");
const comprehensiveAudit = readFileSync(new URL("../scripts/audit-comprehensive-production.cjs", import.meta.url), "utf8");

test("QQQAAA treats an intentional disabled-world redirect as verified, not as a missing control", () => {
  assert.match(mapAudit, /redirectedDisabledWorld/);
  assert.match(mapAudit, /disabledWorldRedirect/);
  assert.match(mapAudit, /availabilityKey/);
  assert.match(responsiveAudit, /redirectedDisabledWorld/);
  assert.match(responsiveAudit, /disabledWorldRedirect/);
  assert.match(responsiveAudit, /document\.documentElement\.innerHTML\.includes/);
  assert.match(comprehensiveAudit, /disabledWorldRedirect/);
  assert.match(comprehensiveAudit, /availabilityKey/);
  assert.match(comprehensiveAudit, /if \(await disabledWorldRedirect\(page, path, world\)\)/);
});
