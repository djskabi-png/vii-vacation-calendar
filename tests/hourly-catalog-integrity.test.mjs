import test from "node:test";
import assert from "node:assert/strict";
import catalog from "../app/data/sergey-hourly-catalog.json" with { type: "json" };
import { safeHourlyDescription } from "../app/lib/hourly-description.ts";

test("hourly catalog does not assign a business description to a different place", () => {
  const sunset = catalog.places.find((place) => place.name === "שקיעה בזכרון");
  const hiddenField = catalog.places.find((place) => place.name === "שדה נסתר");
  assert.ok(sunset);
  assert.ok(hiddenField);
  assert.notEqual(sunset.location, hiddenField.location);
  assert.equal(safeHourlyDescription(sunset), "");
  assert.equal(safeHourlyDescription(hiddenField), hiddenField.description);
  assert.equal(safeHourlyDescription({ id: "hourly-1181", description: "תיאור חדש מאומת" }), "תיאור חדש מאומת");
});
