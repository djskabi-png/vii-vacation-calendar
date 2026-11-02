import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import catalog from "../app/data/sergey-public-catalog.json" with { type: "json" };
import accepted from "../app/data/accepted-runtime-catalog-state.json" with { type: "json" };
import redirects from "../app/data/legacy-redirect-inventory.json" with { type: "json" };
import {
  accommodationCities,
  accommodationLandingForPath,
  indexableAccommodationLandings,
} from "../app/data/accommodation-landings.ts";
import { projectSergeyPublicCatalogValue } from "../app/lib/sergey-public-catalog-projection.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

function acceptedVacations() {
  const state = accepted.worlds.vacations;
  const active = new Set(state.ids);
  const bySupplier = new Map();
  for (const place of [...catalog.places, ...state.additions]) {
    if (place.world === "vacations" && active.has(place.supplierId)) {
      bySupplier.set(place.supplierId, projectSergeyPublicCatalogValue(place));
    }
  }
  return [...bySupplier.values()];
}

test("every active accommodation city has one stable lowercase ASCII slug", () => {
  const cities = accommodationCities(acceptedVacations());
  assert.equal(cities.length, 119);
  assert.equal(new Set(cities.map((city) => city.slug)).size, cities.length);
  for (const city of cities) {
    assert.match(city.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.equal(city.slug.startsWith("city-"), false, `${city.label} needs a readable permanent slug`);
  }
});

test("the full non-empty type, region and city matrix produces unique truthful landings", () => {
  const inventory = acceptedVacations();
  const landings = indexableAccommodationLandings(inventory);
  assert.equal(landings.length, 390);
  assert.equal(new Set(landings.map((landing) => landing.path)).size, landings.length);
  for (const candidate of landings) {
    const landing = accommodationLandingForPath(candidate.category.id, candidate.region?.slug, inventory);
    assert.ok(landing, candidate.path);
    assert.ok(landing.listings.length > 0, `${candidate.path} is empty`);
    assert.equal(landing.path, candidate.path);
    assert.ok(landing.description.includes(String(landing.listings.length)) || landing.listings.length === 1);
  }
});

test("requested examples resolve only when the accepted catalog supports the exact combination", () => {
  const inventory = acceptedVacations();
  const paths = new Set(indexableAccommodationLandings(inventory).map((landing) => landing.path));
  assert.ok(paths.has("/zimmers/north"));
  assert.ok(paths.has("/zimmers/tiberias"));
  assert.ok(paths.has("/vacation-apartments/ashkelon"));
  assert.ok(paths.has("/villas/nahariya"));
  assert.equal(paths.has("/zimmers/nahariya"), false, "the active catalog has no zimmer in Nahariya and must not invent one");
});

test("accommodation pages expose specific metadata, visible guide, FAQs and crawlable related links", () => {
  const route = read("app/components/accommodation-landing-route.tsx");
  const search = read("app/search/page.tsx");
  assert.match(route, /title: `\$\{landing\.title\} \|/);
  assert.match(route, /featureCounts/);
  assert.match(route, /onlineBookingCount/);
  assert.match(route, /maximumGuests/);
  assert.match(route, /relatedLinks/);
  assert.match(route, /faqSchema\(faqs\)/);
  assert.match(search, /accommodation-related-links/);
  assert.match(search, /<Link key=\{item\.href\} href=\{item\.href\}>/);
});

test("legacy accommodation category sources redirect directly to clean canonical category pages", () => {
  const expected = {
    "/s/israel/16094": "/wood-cabins",
    "/s/israel/16095": "/villas",
    "/s/israel/16096": "/zimmers",
    "/s/israel/16097": "/vacation-caves",
    "/s/israel/16101": "/suite-complexes",
    "/s/israel/20158": "/stone-zimmers",
    "/s/israel/55578": "/vacation-apartments",
  };
  for (const [source, target] of Object.entries(expected)) assert.equal(redirects.redirects[source], target);
});

test("the complete managed redirect inventory has no conflicts, self redirects or redirect chains", () => {
  const sources = new Set(Object.keys(redirects.redirects));
  const gone = new Set(redirects.gone);
  assert.ok(sources.size >= 3000);
  for (const [source, target] of Object.entries(redirects.redirects)) {
    assert.equal(gone.has(source), false, `${source} is both redirect and gone`);
    assert.notEqual(source, target, `${source} redirects to itself`);
    const targetUrl = new URL(target, "https://www.vii.co.il");
    assert.equal(sources.has(targetUrl.pathname), false, `${source} creates a redirect chain through ${targetUrl.pathname}`);
  }
});

test("the built worker resolves the complete legacy inventory in one permanent hop", async () => {
  const { default: worker } = await import("../dist/server/index.js");
  const env = { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } };
  const ctx = { waitUntil() {}, passThroughOnException() {} };
  const rows = [
    ...Object.entries(redirects.redirects).map(([source, target]) => ({ source, target, status: 301 })),
    ...redirects.gone.map((source) => ({ source, target: null, status: 410 })),
  ];

  await Promise.all(rows.map(async ({ source, target, status }) => {
    const response = await worker.fetch(new Request(new URL(source, "https://www.vii.co.il")), env, ctx);
    assert.equal(response.status, status, source);
    if (status !== 301) return;
    const actual = new URL(response.headers.get("location"));
    const expected = new URL(target, "https://www.vii.co.il");
    assert.equal(`${actual.pathname}${actual.search}`, `${expected.pathname}${expected.search}`, source);
  }));
});

test("the vacation sitemap contains every truthful accommodation landing and no empty example", async () => {
  const inventory = acceptedVacations();
  const landings = indexableAccommodationLandings(inventory);
  const { default: worker } = await import("../dist/server/index.js");
  const env = { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } };
  const ctx = { waitUntil() {}, passThroughOnException() {} };
  const response = await worker.fetch(new Request("https://www.vii.co.il/sitemaps/vacations/1.xml"), env, ctx);
  assert.equal(response.status, 200);
  const xml = await response.text();
  for (const { path } of landings) {
    assert.match(xml, new RegExp(`<loc>https://www\\.vii\\.co\\.il${path.replaceAll("-", "\\-")}</loc>`), path);
  }
  assert.doesNotMatch(xml, /<loc>https:\/\/www\.vii\.co\.il\/zimmers\/nahariya<\/loc>/);
});
