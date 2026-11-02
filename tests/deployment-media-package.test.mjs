import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const aliasesSource = await readFile("app/lib/deployment-media-aliases.generated.ts", "utf8");
const workerSource = await readFile("worker/index.ts", "utf8");
const pruneSource = await readFile("scripts/prune-deployment-assets.mjs", "utf8");

test("deployment media aliases preserve removed URLs through the Worker", () => {
  assert.match(aliasesSource, /export const deploymentMediaAliases/);
  assert.match(aliasesSource, /"\/og\.png": "\/og-v2\.png"/);
  assert.match(aliasesSource, /"\/vii-calendar-social\.png": "\/og-v2\.png"/);
  assert.doesNotMatch(aliasesSource, /media\\\\/);
  assert.match(workerSource, /deploymentMediaAliases\[url\.pathname\]/);
  assert.match(workerSource, /Response\.redirect\(new URL\(mediaAlias, url\.origin\), 308\)/);
  assert.match(pruneSource, /Object\.keys\(deploymentMediaAliases\)/);
});
