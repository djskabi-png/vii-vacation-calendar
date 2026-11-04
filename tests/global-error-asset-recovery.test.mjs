import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../app/global-error.tsx", import.meta.url), "utf8");
const recovery = await readFile(new URL("../app/lib/release-asset-recovery.ts", import.meta.url), "utf8");

test("a stale deployment asset triggers one bounded hard reload", () => {
  assert.match(recovery, /dynamically imported module/);
  assert.match(recovery, /sessionStorage\.getItem/);
  assert.match(recovery, /now - previous <= RECOVERY_WINDOW_MS/);
  assert.match(recovery, /window\.location\.reload\(\)/);
  assert.match(source, /recoverReleaseAssetMismatch\(error, "global"\)/);
});

test("ordinary application errors still use the React reset boundary", () => {
  assert.match(source, /assetLoadFailure \? window\.location\.reload\(\) : reset\(\)/);
});
