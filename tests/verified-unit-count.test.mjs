import assert from "node:assert/strict";
import test from "node:test";
import { properties } from "../app/data/site-data.ts";

test("verified vacation listings always expose a positive physical unit count", () => {
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
