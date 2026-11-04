import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const audit = await readFile(new URL("../scripts/audit-availability-matrix.mjs", import.meta.url), "utf8");

test("availability audit verifies permanent canonical redirects and their destinations", () => {
  assert.match(audit, /process\.env\.BASE_URL/);
  assert.match(audit, /expectedTargets = \["\/hourly\/search\/haifa", "\/hourly\/search\/haifa-carmel"\]/);
  assert.match(audit, /!\[301, 308\]\.includes\(observation\.redirectStatus\)/);
  assert.match(audit, /observation\.location !== observation\.expectedTarget/);
  assert.match(audit, /observation\.targetStatus !== 200/);
  assert.match(audit, /!observation\.targetHasHeading/);
});
