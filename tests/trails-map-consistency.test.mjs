import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const explorer = await readFile(new URL("../app/trails/trails-explorer.tsx", import.meta.url), "utf8");
const deferredMap = await readFile(new URL("../app/components/deferred-listing-map.tsx", import.meta.url), "utf8");
const listingMap = await readFile(new URL("../app/components/listing-map.tsx", import.meta.url), "utf8");

test("trails share the responsive map control used by every non-provider world", () => {
  assert.match(explorer, /map-button mobile-map-fab/);
  assert.match(explorer, /DeferredTrailMap trails={filtered}/);
  assert.match(deferredMap, /module\.TrailMap/);
  assert.match(listingMap, /export function TrailMap/);
  assert.match(listingMap, /precision: "area"/);
  assert.match(listingMap, /\/trails\?area=/);
});
