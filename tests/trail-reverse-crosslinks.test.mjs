import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("every trail detail receives all four reverse discovery families", async () => {
  const page = await read("app/trails/[slug]/page.tsx");
  const component = await read("app/components/trail-nearby-worlds.tsx");
  assert.match(page, /<TrailNearbyWorlds area=\{trail\.mainArea\}/);
  for (const label of ["נופש ליד המסלול", "ספא באזור", "אטרקציות בסביבה", "ספקים שמגיעים לאזור"]) assert.match(component, new RegExp(label));
  assert.match(component, /\/business\?id=/);
  assert.match(component, /\/discover\/place\//);
});

test("trail crosslinks use eligible inventory and regional recommendation policy", async () => {
  const page = await read("app/trails/[slug]/page.tsx");
  assert.match(page, /property\.active !== false && property\.indexable !== false/);
  assert.match(page, /item\.indexable !== false && Boolean\(item\.image\)/);
  assert.match(page, /nearbyRecommendations\(publicVacations/);
  assert.match(page, /nearbyRecommendations\(managedAttractions/);
  assert.equal((page.match(/minimum:\s*0/g) || []).length, 3, "location-labelled groups must not be padded from unrelated regions");
  assert.match(page, /item\.serviceAreas\?\.some/);
});

test("trail crosslinks use one compact responsive grid instead of four heavy rails", async () => {
  const component = await read("app/components/trail-nearby-worlds.tsx");
  const styles = await read("app/globals.css");
  assert.doesNotMatch(component, /HomeMobileRail|data-horizontal-rail/);
  assert.match(styles, /\.trail-nearby-worlds__grid \{[^}]*grid-template-columns: repeat\(2,minmax\(0,1fr\)\)/s);
  assert.match(styles, /@media \(max-width: 820px\)[\s\S]*?\.trail-nearby-worlds__grid \{ grid-template-columns: 1fr; \}/);
});
