import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const catalog = JSON.parse(await readFile(new URL("../app/data/legacy-place-feature-groups.json", import.meta.url), "utf8"));

test("2728 has refreshed place-scoped legacy groups, not unit-only facts", () => {
  const groups = catalog.groups["vacation-2728"];
  assert.ok(Array.isArray(groups) && groups.length >= 3);
  assert.ok(groups.some((group) => group.title === "מתחם חיצוני"));
  assert.ok(groups.some((group) => group.title === "מתחם פנימי"));
  const allItems = groups.flatMap((group) => group.items);
  assert.ok(!allItems.includes("מקרר מיני"));
  assert.ok(!allItems.includes("מזרן"));
});
