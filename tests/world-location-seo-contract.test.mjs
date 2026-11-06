import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {worldLocationPath} from '../app/lib/world-location-path.ts';

const read = (path) => fs.readFileSync(path, "utf8");
const registry = JSON.parse(read("app/data/approved-world-locations.json"));

test("the approved location registry covers every world and keeps labels unique", () => {
  for (const world of ["vacation", "events", "spa", "hourly"]) {
    assert.ok(Array.isArray(registry[world]));
    assert.ok(registry[world].includes("ראשון לציון"));
    assert.equal(new Set(registry[world]).size, registry[world].length);
  }
  assert.ok(registry.hourly.includes("צפון"));
  assert.match(read("app/data/search-taxonomy.ts"), /hourly:\s*\["כל הארץ", "צפון"/);
});

test("all four worlds expose clean semantic location routes", () => {
  const inventory = read("app/lib/world-location-pages.ts");
  assert.match(inventory, /approvedLocations\[mode\]/);
  for(const [mode,base]of Object.entries({vacation:'/vacations/search',events:'/events/search',spa:'/spas/search',hourly:'/hourly/search'}))assert.equal(worldLocationPath(mode,'ראשון לציון'),base+'/rishon-lezion');
  assert.match(read("app/lib/location-slug.ts"), /"ראשון לציון":\s*"rishon-lezion"/);
});

test("approved location query URLs permanently redirect and unknown locations remain usable", () => {
  const proxy = read("proxy.ts");
  const policy=read('app/lib/canonical-location-redirect.ts');
  assert.match(proxy, /canonicalLocationDestination\(request\.nextUrl\)/);
  assert.match(proxy, /NextResponse\.redirect\(canonicalLocation,\s*301\)/);
  assert.match(policy,/approvedLocations\[route\.world\]\.includes\(location\)/);
  assert.match(policy, /searchParams\.delete\(['"]location['"]\)/);
  assert.match(proxy, /return NextResponse\.next\(\)/);
});

test("sitemaps and autocomplete consume the complete accepted inventory", () => {
  const sitemap = read("app/lib/sitemap-inventory.ts");
  for (const world of ["vacation", "events", "spa", "hourly"]) {
    assert.match(sitemap, new RegExp(`worldLocationInventory\\("${world}"\\)`));
  }
  const searchBox = read("app/components/search-box.tsx");
  assert.match(searchBox, /placeInventory\.flatMap\(\(place\) => \[place\.area, place\.location\]\)/);
  assert.match(searchBox, /catalogDestinations/);
});

test("vacation location pages include canonical metadata, useful copy and FAQ", () => {
  const route = read("app/vacations/search/[location]/page.tsx");
  const landing = read("app/components/vacation-landing-route.tsx");
  assert.match(route, /alternates:\s*\{ canonical: approved\.path \}/);
  assert.match(landing, /guideParagraphs/);
  assert.match(landing, /אפשרות הזמנה אונליין מוצגת רק כאשר קיימים גם זמינות וגם מחיר/);
  assert.match(landing, /faqs/);
});
