import assert from "node:assert/strict";
import test from "node:test";
import { distanceKm, nearbyPlacesForSelection } from "../app/lib/geography-search.ts";

const nodes = [
  { key: "city:700", level: "city", parentKey: "area:9", title: "ישרש", titleEn: "Yashresh", slug: "yashresh", featured: false, gpsLat: 31.916, gpsLong: 34.849, unassigned: false },
  { key: "city:701", level: "city", parentKey: "area:9", title: "רחובות", titleEn: "Rehovot", slug: "rehovot", featured: false, gpsLat: 31.894, gpsLong: 34.811, unassigned: false },
];

test("nearby geography recovery is distance ordered and bounded", () => {
  const nearby = nearbyPlacesForSelection([
    { location: "רחובות", lat: 31.894, lng: 34.811 },
    { location: "אשדוד", lat: 31.801, lng: 34.643 },
    { location: "אילת", lat: 29.557, lng: 34.951 },
  ], nodes, "ישרש", { maximumDistanceKm: 40 });
  assert.deepEqual(nearby.map((item) => item.place.location), ["רחובות", "אשדוד"]);
  assert.ok(nearby[0].distanceKm < nearby[1].distanceKm);
});

test("nearby geography recovery accepts English title and slug", () => {
  const place = { location: "רחובות", lat: 31.894, lng: 34.811 };
  assert.equal(nearbyPlacesForSelection([place], nodes, "Yashresh").length, 1);
  assert.equal(nearbyPlacesForSelection([place], nodes, "yashresh").length, 1);
});

test("nearby geography recovery enriches catalog places from their managed city", () => {
  const nearby = nearbyPlacesForSelection([
    { location: "רחובות" },
    { location: "עיר שלא קיימת" },
  ], nodes, "ישרש", { maximumDistanceKm: 10 });
  assert.deepEqual(nearby.map((item) => item.place.location), ["רחובות"]);
});

test("nearby recovery expands beyond the preferred radius to satisfy a minimum", () => {
  const nearby = nearbyPlacesForSelection([
    { location: "רחובות", lat: 31.894, lng: 34.811 },
    { location: "תל אביב", lat: 32.0853, lng: 34.7818 },
    { location: "חיפה", lat: 32.794, lng: 34.9896 },
  ], nodes, "ישרש", { maximumDistanceKm: 10, minimumResults: 3, limit: 3 });
  assert.equal(nearby.length, 3);
  assert.deepEqual(nearby.map((item) => item.place.location), ["רחובות", "תל אביב", "חיפה"]);
});

test("nearby geography recovery does not invent results without coordinates", () => {
  const coordinateFree = [{ ...nodes[0], gpsLat: null, gpsLong: null }];
  assert.deepEqual(nearbyPlacesForSelection([{ location: "רחובות", lat: 31.894, lng: 34.811 }], coordinateFree, "ישרש"), []);
});

test("haversine distance remains symmetric", () => {
  const first = { lat: 31.916, lng: 34.849 };
  const second = { lat: 31.894, lng: 34.811 };
  assert.equal(distanceKm(first, second), distanceKm(second, first));
});

test("regions without coordinates rank from managed descendant city coordinates", () => {
  const region = { key: "area:9", level: "area", parentKey: null, title: "אזור בדיקה", titleEn: "Test area", slug: "test-area", featured: false, gpsLat: null, gpsLong: null, unassigned: false };
  const result = nearbyPlacesForSelection([{ id: "near", lat: 31.9, lng: 34.83 }, { id: "far", lat: 33, lng: 35 }], [region, ...nodes], region.title, { minimumResults: 3 });
  assert.deepEqual(result.map((entry) => entry.place.id), ["near", "far"]);
});

test("geography ranking deduplicates identity before limiting minimum results", () => {
  const near = { id: "near", lat: 31.9, lng: 34.83 };
  const result = nearbyPlacesForSelection([near, { ...near }, { id: "far", lat: 33, lng: 35 }, { id: "last", lat: 29.5, lng: 35 }], nodes, "ישרש", { minimumResults: 3, limit: 3 });
  assert.deepEqual(result.map((entry) => entry.place.id), ["near", "far", "last"]);
});
