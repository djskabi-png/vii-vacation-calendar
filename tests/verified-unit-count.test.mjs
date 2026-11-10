import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../app/data/site-data.ts", import.meta.url), "utf8");
const catalog = JSON.parse(await readFile(new URL("../app/data/sergey-public-catalog.json", import.meta.url), "utf8"));
const properties = catalog.places.filter((place) => place.world === "vacations").map((place) => ({
  ...place,
  units: Number.isInteger(place.units) && place.units > 0 ? place.units : 1,
}));

test("verified vacation listings always expose a positive physical unit count", () => {
  assert.match(source, /units: Number\.isInteger\(place\.units\) && place\.units > 0 \? place\.units : 1/);
  const verified = properties.filter((property) => property.slug.startsWith("vacation-"));
  assert.ok(verified.length > 0);
  for (const property of verified) {
    assert.equal(Number.isInteger(property.units), true, `${property.slug} must expose an integer unit count`);
    assert.ok(property.units > 0, `${property.slug} must expose at least one bookable unit`);
  }
});

test("standalone accommodation labels count as one unit rather than room count", () => {
  const standalone = properties.find((property) => property.slug === "vacation-689");
  assert.ok(standalone);
  assert.equal(standalone.units, 1);
});
