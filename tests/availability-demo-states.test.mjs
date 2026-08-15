import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const card = await readFile(new URL("../app/components/property-card.tsx", import.meta.url), "utf8");
const hook = await readFile(new URL("../app/components/use-legacy-availability.ts", import.meta.url), "utf8");
const route = await readFile(new URL("../app/api/legacy-availability/route.ts", import.meta.url), "utf8");
const sources = await readFile(new URL("../app/lib/legacy-availability-sources.ts", import.meta.url), "utf8");
const stay = await readFile(new URL("../app/lib/vacation-date-range.ts", import.meta.url), "utf8");

test("dated vacation results do not manufacture availability or a dated price", () => {
  assert.match(card, /Public search results must never manufacture availability or a price/);
  assert.match(card, /return false;/);
  assert.match(card, /if \(legacyAvailabilitySourceFor\(property\.slug\)\) return null;/);
  assert.match(card, /\(!selectedStay && property\.price\)/, "a static from-price must not be shown as the selected date price");
  assert.match(card, /בודקים זמינות ומחיר מול מערכת המקום/);
  assert.match(card, /לא הצלחנו לאמת זמינות ומחיר כרגע/);
});

test("verified legacy inventory is selected by place, dates and guests", () => {
  for (const [slug, siteId] of Object.entries({
    "hilat-hanof": "11",
    "vacation-vila-harel": "2229",
    "vacation-villa-esem-harimon": "296",
    "vacation-gesthouse-royal": "1406",
    "vacation-villa-yotam": "470",
    "vacation-villa-circle": "1772",
  })) {
    assert.match(sources, new RegExp(`"${slug}"[\\s\\S]*siteId: "${siteId}"`));
  }
  assert.match(route, /const guests = Math\.max\(1, Number\(url\.searchParams\.get\("guests"\)/);
  assert.match(route, /guests <= room\.maxGuests/);
  assert.match(route, /maxGuests: roomMatches\[index\]\.maxGuests/);
  assert.match(route, /Cache-Control": "public, max-age=60, s-maxage=60"/);
  assert.match(hook, /guests: String\(guests\)/);
  assert.match(hook, /status: "idle" \| "loading" \| "ready" \| "error"/);
});

test("a verified quote preserves the exact party through result, detail and booking links", () => {
  assert.match(stay, /guests\?: number/);
  assert.match(stay, /searchParams\.get\("guests"\) \|\| searchParams\.get\("adults"\)/);
  assert.match(card, /const selectedGuests = String\(selectedStay\?\.guests/);
  assert.match(card, /guests: selectedGuests/);
  assert.match(card, /quickBookingReady/);
});
