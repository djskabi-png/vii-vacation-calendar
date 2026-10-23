import assert from "node:assert/strict";
import test from "node:test";
import { nearbyRecommendations, nearbySearchRecommendations, nearbyRecommendationCopy, completeNearbyResults, completePlaceSearchResults, PLACE_SEARCH_MINIMUM_RESULTS } from "../app/lib/nearby-recommendations.ts";
import { nearbyTrails, trails } from "../app/data/trail-data.ts";

const origin = { location: "תל אביב", area: "מרכז", lat: 32.08, lng: 34.78 };
const make = (id, lat, area = "מרכז") => ({ id, location: id, area, lat, lng: 34.78 });
const key = (item) => item.id;

test("a city absent from legacy coordinate dictionaries ranks from managed geography,not catalog order", () => {
  const cities = [
    ["נצרת", 32.699, 35.304], ["טבריה", 32.794, 35.532],
    ["חיפה", 32.794, 34.989], ["תל אביב", 32.085, 34.781],
  ].map(([title, gpsLat, gpsLong], index) => ({ key: `city:${index}`, level: "city", parentKey: null,
    title, titleEn: title, slug: String(index), featured: false, gpsLat, gpsLong, unassigned: false }));
  const pool = ["תל אביב", "נצרת", "חיפה", "טבריה"].map((location) => ({ id: location, location }));
  const result = nearbySearchRecommendations(pool, "נצרת", cities, { key });
  assert.deepEqual(result.map(key), ["נצרת", "טבריה", "חיפה", "תל אביב"]);
  assert.deepEqual(completeNearbyResults([pool[1]], result, key).map(key), ["נצרת", "טבריה", "חיפה"]);
});

test("unknown cities without a managed or coarse anchor never imply nearest catalog-order results", () => {
  assert.deepEqual(nearbySearchRecommendations([make("one", 32), make("two", 33), make("three", 34)], "עיר לא ידועה", [], { key }), []);
});

test("known sparse regions still return the nearest eligible pool when venue city coordinates are incomplete", () => {
  const nodes = [{ key: "area:eilat", level: "area", parentKey: null, title: "אילת והערבה", titleEn: "Eilat and Arava",
    slug: "eilat", featured: true, gpsLat: 29.56, gpsLong: 34.95, unassigned: false }];
  const eligible = [
    { id: "south", location: "יישוב ספק ללא נקודה", area: "דרום ונגב" },
    { id: "center", location: "עיר ספק ללא נקודה", area: "מרכז" },
    { id: "north", location: "מיקום ספק ללא נקודה", area: "צפון" },
  ];
  assert.deepEqual(nearbySearchRecommendations(eligible, "אילת והערבה", nodes, { key }).map(key), ["south", "center", "north"]);
});

test("sparse geography expands to3 nearest eligible distinct recommendations", () => {
  const result = nearbyRecommendations([make("far", 33.7), make("near", 32.1), make("middle", 32.6), make("furthest", 34)], origin, { key });
  assert.deepEqual(result.items.map(key), ["near", "middle", "far"]);
  assert.equal(result.expanded, true);
  assert.equal(result.regionalOnly, false);
});

test("normal nearby inventory keeps its full approved limit,without artificial truncation", () => {
  const pool = Array.from({ length: 8 }, (_, i) => make(String(i), 32.08 + i * .01));
  assert.equal(nearbyRecommendations(pool, origin, { key }).items.length, 6);
});

test("true eligible shortages are never fabricated or padded with duplicates", () => {
  for (const count of [0, 1, 2, 3]) {
    const pool = Array.from({ length: count }, (_, i) => make(String(i), 32.1));
    assert.equal(nearbyRecommendations([...pool, ...pool], origin, { key }).items.length, count);
  }
});

test("exclude applies before minimum and geographical expansion", () => {
  const pool = [make("current", 32.08), make("a", 32.09), make("b", 32.6), make("c", 33.7)];
  assert.deepEqual(nearbyRecommendations(pool, origin, { key, exclude: "current" }).items.map(key), ["a", "b", "c"]);
});

test("caller's hardfiltered pool is the entire candidate universe", () => {
  const unavailableOrWrongType = make("not-eligible", 32.081);
  const eligible = [make("allowed", 32.1)];
  assert.ok(unavailableOrWrongType);
  assert.deepEqual(nearbyRecommendations(eligible, origin, { key }).items.map(key), ["allowed"]);
});

test("regional-only fallbacks are explicitly approximate and keep matching region first", () => {
  const pool = [{ id: "north", area: "גליל עליון" }, { id: "center", area: "מישור החוף והשפלה" }, { id: "tel-aviv", area: "תל אביב" }];
  const result = nearbyRecommendations(pool, { area: "מרכז" }, { key });
  assert.equal(result.items[0].id, "center");
  assert.equal(result.regionalOnly, true);
  assert.equal(result.expanded, true);
});

test("one local trail expands to3 actual regional trails without precise-distance claims", () => {
  const local = trails.filter((trail) => trail.mainArea === "תל אביב");
  const inventory = [local[0], ...trails.filter((trail) => trail.mainArea !== "תל אביב").slice(0, 5)];
  const result = nearbyTrails("תל אביב", "תל אביב", 6, { inventory });
  assert.ok(result.length >= 3);
  assert.equal(new Set(result.map((trail) => trail.slug)).size, result.length);
  assert.equal(result[0].mainArea, "תל אביב");
});

test("managed trail pool and current-trail exclusion are honored before topup", () => {
  const pool = trails.slice(0, 4);
  const result = nearbyTrails("תל אביב", "", 6, { inventory: pool, excludeSlug: pool[0].slug });
  assert.equal(result.length, 3);
  assert.ok(result.every((trail) => pool.includes(trail) && trail.slug !== pool[0].slug));
  assert.equal(nearbyTrails("תל אביב", "", 6, { inventory: pool.slice(0, 2) }).length, 2);
});

test("all4locales disclose wider-area and regional-only ordering", () => {
  for (const language of ["he", "en", "ru", "fr"]) {
    const copy = nearbyRecommendationCopy[language];
    assert.ok(copy.expanded.length > 30);
    assert.ok(copy.regional.length > 30);
    assert.ok(copy.trails.length > 30);
  }
});

test("search topup never caps a complete catalog and preserves exact matches first", () => {
  const exact = Array.from({ length: 24 }, (_, i) => make(String(i), 32.1));
  assert.deepEqual(completeNearbyResults(exact, [], key), exact);
  assert.deepEqual(completeNearbyResults(exact.slice(0, 2), [exact[1], exact[2], exact[3]], key).map(key), ["0", "1", "2"]);
  assert.deepEqual(completeNearbyResults([], [exact[1], exact[1], exact[2]], key).map(key), ["1", "2"]);
});

test("place searches append nearest eligible distinct places until the shared minimum of18", () => {
  const cities = Array.from({ length: 24 }, (_, index) => ({
    key: `city:${index}`,
    level: "city",
    parentKey: null,
    title: index === 0 ? "משמר הירדן" : `יישוב ${index}`,
    titleEn: `City ${index}`,
    slug: `city-${index}`,
    featured: false,
    gpsLat: 32.96 + index * 0.01,
    gpsLong: 35.60,
    unassigned: false,
  }));
  const pool = cities.map((city, index) => ({ id: `place-${index}`, location: city.title }));
  const exact = pool.slice(0, 3);
  const nearby = nearbySearchRecommendations(pool, "משמר הירדן", cities, { key });
  const completed = completePlaceSearchResults(exact, nearby, key);
  assert.equal(PLACE_SEARCH_MINIMUM_RESULTS, 18);
  assert.equal(completed.length, 18);
  assert.deepEqual(completed.slice(0, 3), exact);
  assert.equal(new Set(completed.map(key)).size, 18);
  assert.deepEqual(completed.slice(3).map(key), pool.slice(3, 18).map(key));
});

test("place searches stop at truthful eligible inventory instead of fabricating eighteen", () => {
  const eligible = Array.from({ length: 7 }, (_, index) => make(`eligible-${index}`, 32.1 + index * .01));
  const completed = completePlaceSearchResults(eligible.slice(0, 2), [...eligible, ...eligible], key);
  assert.equal(completed.length, 7);
  assert.deepEqual(new Set(completed.map(key)), new Set(eligible.map(key)));
});
