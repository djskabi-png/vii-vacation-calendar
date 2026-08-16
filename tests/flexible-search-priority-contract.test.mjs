import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const flexibleDates = readFileSync(new URL("../app/lib/flexible-vacation-search.ts", import.meta.url), "utf8");
const availability = readFileSync(new URL("../app/components/use-legacy-availability.ts", import.meta.url), "utf8");
const search = readFileSync(new URL("../app/search/page.tsx", import.meta.url), "utf8");

test("flexible weekend searches prioritize exact weekends before flexible fallbacks", () => {
  assert.match(flexibleDates, /weekend:\s*\{ nights: 2, preferredWeekday: 5 \}/);
  assert.match(flexibleDates, /for \(const offset of offsets\)[\s\S]*for \(const preferredStart of preferredStarts\)/);
  assert.match(flexibleDates, /month is tried before the flexible fallbacks/);
});

test("flexible availability only promotes a verified available quote with a price", () => {
  assert.match(availability, /useLegacyFlexibleAvailabilityBatch/);
  assert.match(availability, /quote\.availability === "available" && typeof quote\.nightlyPrice === "number" && quote\.nightlyPrice > 0/);
  assert.match(availability, /firstAvailable/);
});

test("flexible result cards receive the exact verified stay and surface the ordering rule", () => {
  assert.match(search, /flexibleVacationCandidates\(flexibleSearch, guests\)/);
  assert.match(search, /selectedStayFor\(property\.slug\)/);
  assert.match(search, /Available weekends with a price appear first/);
  assert.match(search, /useLegacyFlexibleAvailabilityBatch\(mapCandidates, flexibleCandidates\)/);
});
