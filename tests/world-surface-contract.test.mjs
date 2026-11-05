import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const shell = fs.readFileSync(new URL("../app/components/page-shell.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const contract = fs.readFileSync(new URL("../app/lib/world-surface-contract.ts", import.meta.url), "utf8");

test("page shell emits an explicit world surface boundary", () => {
  assert.match(shell, /worldSurfaceAttributes\(variant\)/);
  assert.match(shell, /<div \{\.\.\.surface\}/);
  assert.match(contract, /data-world-surface/);
});

test("spa styles use the fail-closed build slot", () => {
  assert.match(css, /VII_SPA_AUDIENCE_DATE_CSS_SLOT/);
  assert.doesNotMatch(css, /\.site-page\[data-world-surface="spa"\]/);
  assert.match(contract, /WORLD_SURFACE_IDS/);
});
