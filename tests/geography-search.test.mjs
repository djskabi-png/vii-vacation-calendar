import assert from "node:assert/strict";
import test from "node:test";
import { distanceKm, nearbyPlacesForSelection } from "../app/lib/geography-search.ts";

const nodes = [
  { key: "city:700", level: "city", parentKey: "area:9", title: "ישרש", titleEn: "Yashresh", slug: "yashresh", featured: false, gpsLat: 31.916, gpsLong: 34.849, unassigned: false },
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

test("nearby geography recovery does not invent results without coordinates", () => {
  const coordinateFree = [{ ...nodes[0], gpsLat: null, gpsLong: null }];
  assert.deepEqual(nearbyPlacesForSelection([{ location: "רחובות", lat: 31.894, lng: 34.811 }], coordinateFree, "ישרש"), []);
});

test("haversine distance remains symmetric", () => {
  const first = { lat: 31.916, lng: 34.849 };
  const second = { lat: 31.894, lng: 34.811 };
  assert.equal(distanceKm(first, second), distanceKm(second, first));
});
