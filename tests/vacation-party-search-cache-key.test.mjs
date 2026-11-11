import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(new URL("../app/components/use-vii-live-search.ts", import.meta.url), "utf8");

test("dated vacation discovery cache identity includes the room composition", () => {
  assert.match(source, /\$\{includePlaces \? "places" : "results"\}:\$\{roomKey\}/);
});
