import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { getIsraelGreeting, getIsraelHour } from "../app/admin/israel-greeting.ts";

const israelInstant = (iso) => new Date(iso);

test("admin greeting uses Israel time in winter and summer", () => {
  assert.equal(getIsraelHour(israelInstant("2026-01-15T13:00:00.000Z")), 15);
  assert.equal(getIsraelGreeting(israelInstant("2026-01-15T13:00:00.000Z")), "צהריים טובים");
  assert.equal(getIsraelHour(israelInstant("2026-07-15T12:00:00.000Z")), 15);
  assert.equal(getIsraelGreeting(israelInstant("2026-07-15T12:00:00.000Z")), "צהריים טובים");
});

test("admin greeting covers every Israel-time boundary", () => {
  const cases = [
    ["2026-01-15T02:59:00.000Z", "לילה טוב"],
    ["2026-01-15T03:00:00.000Z", "בוקר טוב"],
    ["2026-01-15T09:59:00.000Z", "בוקר טוב"],
    ["2026-01-15T10:00:00.000Z", "צהריים טובים"],
    ["2026-01-15T14:59:00.000Z", "צהריים טובים"],
    ["2026-01-15T15:00:00.000Z", "ערב טוב"],
    ["2026-01-15T18:59:00.000Z", "ערב טוב"],
    ["2026-01-15T19:00:00.000Z", "לילה טוב"],
  ];
  for (const [iso, expected] of cases) assert.equal(getIsraelGreeting(israelInstant(iso)), expected, iso);
});

test("admin dashboard renders the dynamic greeting and keeps it fresh", async () => {
  const source = await readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8");
  assert.match(source, /getIsraelGreeting/);
  assert.match(source, /setInterval\(updateGreeting, 60_000\)/);
  assert.doesNotMatch(source, /`בוקר טוב, \$\{overview\.account\.name/);
});
