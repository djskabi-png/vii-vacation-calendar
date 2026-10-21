import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const matrixPath = resolve(root, "project_knowledge/release_evidence/VII_REGRESSION_GUARD_MATRIX.json");
const matrix = JSON.parse(await readFile(matrixPath, "utf8"));

assert.equal(matrix.schema_version, 1, "unsupported regression guard matrix schema");
assert.ok(Array.isArray(matrix.rules) && matrix.rules.length >= 12, "regression guard matrix is incomplete");

const ids = new Set();
for (const rule of matrix.rules) {
  assert.match(rule.id ?? "", /^[a-z0-9]+(?:-[a-z0-9]+)+$/, "every guard needs a stable kebab-case id");
  assert.ok(!ids.has(rule.id), `duplicate regression guard id: ${rule.id}`);
  ids.add(rule.id);
  assert.ok((rule.requirement ?? "").length >= 24, `guard ${rule.id} needs an observable requirement`);
  assert.match(rule.test_file ?? "", /^tests\/[a-z0-9-]+\.test\.mjs$/, `guard ${rule.id} must point to one test file`);
  assert.ok((rule.test_title ?? "").length >= 12, `guard ${rule.id} needs a specific test signature`);

  const testPath = resolve(root, rule.test_file);
  const source = await readFile(testPath, "utf8");
  assert.match(source, new RegExp(rule.test_title), `guard ${rule.id} lost its required regression assertion`);
}

process.stdout.write(`${JSON.stringify({ regressionGuards: matrix.rules.length, status: "verified" })}\n`);
