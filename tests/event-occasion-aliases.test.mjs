import test from "node:test";
import assert from "node:assert/strict";
import { normalizeEventOccasion, matchesEventOccasion } from "../app/lib/event-search-taxonomy.ts";

test("event occasion URL aliases match canonical supplier facets", () => {
  const place = { eventTypes: ["ימי הולדת", "אירועי חברה", "חתונות", "קבוצות"] };
  for (const [alias, canonical] of [["יום הולדת", "ימי הולדת"], ["אירוע חברה", "אירועי חברה"], ["חתונה", "חתונות"], ["קבוצה", "קבוצות"]]) {
    assert.equal(normalizeEventOccasion(alias), canonical);
    assert.equal(matchesEventOccasion(place, alias), true, alias);
    assert.equal(matchesEventOccasion(place, canonical), true, canonical);
  }
  assert.equal(matchesEventOccasion(place, "מסיבת רווקים"), false);
});
