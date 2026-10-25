import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [page, css] = await Promise.all([
  readFile(new URL("../app/admin/geography/page.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/admin/geography/geography.module.css", import.meta.url), "utf8"),
]);

test("geography admin exposes every town missing either map coordinate", () => {
  assert.match(page, /node\.level === "city" && \(node\.gpsLat === null \|\| node\.gpsLong === null\)/);
  assert.match(page, /יישובים בלי נקודת מפה/);
  assert.match(page, /הצגת הרשימה/);
  assert.match(page, /חסרה נקודת מפה/);
  assert.match(page, /setMissingCoordinatesOnly\(true\)/);
});

test("missing map-point filter is visibly distinct and responsive", () => {
  assert.match(css, /metricAttention/);
  assert.match(css, /activeIssueFilter/);
  assert.match(css, /nodeList i/);
  assert.match(css, /grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
});
