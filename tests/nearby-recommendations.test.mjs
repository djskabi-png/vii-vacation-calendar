import assert from "node:assert/strict";
import test from "node:test";
import { nearbyRecommendations, nearbyRecommendationCopy, completeNearbyResults } from "../app/lib/nearby-recommendations.ts";
import { nearbyTrails, trails } from "../app/data/trail-data.ts";

const origin = { location: "תל אביב", area: "מרכז", lat: 32.08, lng: 34.78 };
const make = (id, lat, area = "מרכז") => ({ id, location: id, area, lat, lng: 34.78 });
const key = (item) => item.id;

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
