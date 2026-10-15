import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const component = readFileSync(new URL("../app/components/search-after-results.tsx", import.meta.url), "utf8");
const model = readFileSync(new URL("../app/lib/search-depth-model.ts", import.meta.url), "utf8");
const seed = readFileSync(new URL("../app/components/search-depth-seed.tsx", import.meta.url), "utf8");
const vacation = readFileSync(new URL("../app/search/page.tsx", import.meta.url), "utf8");
const vacationLayout = readFileSync(new URL("../app/search/layout.tsx", import.meta.url), "utf8");
const eventLayout = readFileSync(new URL("../app/events/search/layout.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("search depth separates regions, cities, place types, smart searches and additional regions", () => {
  for (const key of ["suitableRegions", "citiesInArea", "placeTypes", "smartSearches", "additionalRegions"]) {
    assert.match(component, new RegExp(`${key}:`));
  }
  assert.match(component, /locationLayers\.suitableRegions/);
  assert.match(component, /locationLayers\.cities/);
  assert.match(component, /isPlaceTypeSuggestion/);
  assert.match(component, /additionalRegionLinks/);
  assert.match(model, /exactAreas\.length[\s\S]*inventory\.filter\(\(item\) => exactAreas\.includes\(item\.area\)\)/);
});

test("vacation smart searches include audiences and location-scoped labels", () => {
  assert.match(vacation, /label: "נופש לזוג"/);
  assert.match(vacation, /label: "נופש למשפחה"/);
  assert.match(vacation, /label: "נופש לקבוצה"/);
  assert.match(component, /scopeSuggestionLabel/);
  assert.match(component, /return `\$\{prefix\} \$\{place\}\$\{label\.slice\(prefix\.length\)\}`/);
  assert.match(component, /new URLSearchParams\(currentQuery\)/);
});

test("vacation and event search receive compact trail and verified-provider seeds", () => {
  assert.match(seed, /SearchDepthSeedContext/);
  for (const layout of [vacationLayout, eventLayout]) {
    assert.match(layout, /trails\.map/);
    assert.match(layout, /providerProfiles\.filter\(\(item\) => item\.indexable !== false && item\.image\)/);
    assert.match(layout, /<SearchDepthSeed value=\{searchDepthSeed\}>/);
  }
  assert.match(component, /trail\.areaTags\.reduce/);
  assert.match(component, /provider\.serviceAreas/);
  assert.match(component, /כל הארץ\|בכל הארץ\|לפי מיקום/);
});

test("visual complementary rails are bounded, lazy and mobile sized", () => {
  assert.match(component, /VisualDiscoveryRail/);
  assert.match(component, /SliderRailControls/);
  assert.match(component, /loading="lazy"/);
  assert.match(css, /\.search-depth__visual-rail \{[^}]*grid-auto-columns:/);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.search-depth__visual-rail \{[^}]*82vw/);
});

test("unsupported complementary rows render nothing instead of empty sliders", () => {
  assert.match(component, /if \(!links\.length\) return null/);
  assert.match(component, /contextualComplementsAllowed/);
  assert.match(component, /Boolean\(location\) && !isWholeCountrySelection\(location\)/);
});
