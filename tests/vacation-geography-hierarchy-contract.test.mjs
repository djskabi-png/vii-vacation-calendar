import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import catalog from "../app/data/sergey-public-catalog.json" with { type: "json" };

const source = await readFile(new URL("../app/data/vacation-landings.ts", import.meta.url), "utf8");

test("vacation hierarchy is derived from published catalog rows", () => {
  assert.match(source, /export function vacationRegionHierarchy/);
  assert.match(source, /vacationRegionListings\(region, inventory\)/);
  assert.match(source, /property\.area/);
  assert.match(source, /property\.location/);
  assert.match(source, /worldLocationPath\("vacation", label\)/);
});

test("property breadcrumbs retain region, subregion and town when represented", () => {
  assert.match(source, /export function vacationBreadcrumbTrailForProperty/);
  assert.match(source, /subregion \? \[\{ name: subregion\.label, path: subregion\.path \}\]/);
  assert.match(source, /town \? \[\{ name: town\.label, path: town\.path \}\]/);
  assert.doesNotMatch(source, /const (?:cities|subregions) = \[/);
});

test("region navigation uses native disclosure and catalog-derived links", async () => {
  const component = await readFile(new URL("../app/components/vacation-geography-nav.tsx", import.meta.url), "utf8");
  assert.match(component, /<details open>/);
  assert.equal((component.match(/<details open>/g) || []).length, 2);
  assert.match(component, /translate\("אזורים"\)/);
  assert.doesNotMatch(component, /translate\("אזורים ויישובים"\)/);
  assert.match(component, /vacationRegionHierarchy\(region, inventory\)/);
  assert.match(component, /<Link key=\{`area-\$\{item\.label\}`\} href=\{item\.path\}/);
});

test("the accepted catalog contains Netua under Western Galilee", () => {
  const rows = catalog.places.filter((place) => place.location === "נטועה");
  assert.ok(rows.length > 0);
  assert.ok(rows.every((place) => place.area === "גליל מערבי"));
});
