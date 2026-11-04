import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { quotedPriceGuestCount, quotedPriceGuestLabel } from "../app/lib/quoted-price-guests.ts";

test("a priced card describes the exact requested party instead of supplier basis occupancy", () => {
  assert.equal(quotedPriceGuestCount(6, true), 6);
  assert.equal(quotedPriceGuestLabel("he", 6, true), "המחיר עבור 6 אורחים");
  assert.doesNotMatch(quotedPriceGuestLabel("he", 6, true), /2 אורחים/);
});

test("guest-price copy uses singular and plural in every supported locale", () => {
  assert.equal(quotedPriceGuestLabel("he", 1, true), "המחיר עבור אורח אחד");
  assert.equal(quotedPriceGuestLabel("en", 1, true), "Price for 1 guest");
  assert.equal(quotedPriceGuestLabel("en", 3, true), "Price for 3 guests");
  assert.equal(quotedPriceGuestLabel("ru", 1, true), "Цена для 1 гостя");
  assert.equal(quotedPriceGuestLabel("ru", 4, true), "Цена для 4 гостей");
  assert.equal(quotedPriceGuestLabel("fr", 1, true), "Prix pour 1 personne");
  assert.equal(quotedPriceGuestLabel("fr", 5, true), "Prix pour 5 personnes");
});

test("unpriced or invalid requests never invent a personalized guest-price claim", () => {
  assert.equal(quotedPriceGuestLabel("he", 6, false), null);
  assert.equal(quotedPriceGuestLabel("he", undefined, true), null);
  assert.equal(quotedPriceGuestLabel("he", 0, true), null);
  assert.equal(quotedPriceGuestLabel("he", 2.5, true), null);
});

test("the shared card reads quote composition from selectedStay and all deal producers preserve it", async () => {
  const root = new URL("../", import.meta.url);
  const [card, search, home, holiday] = await Promise.all([
    readFile(new URL("app/components/property-card.tsx", root), "utf8"),
    readFile(new URL("app/search/page.tsx", root), "utf8"),
    readFile(new URL("app/components/home-live-deals.tsx", root), "utf8"),
    readFile(new URL("app/components/holiday-live-deals.tsx", root), "utf8"),
  ]);
  assert.match(card, /quotedPriceGuestLabel\(language, resolvedAvailability\?\.quotedGuests, hasQuotedPrice\)/);
  assert.doesNotMatch(card, /copy\.includedGuests\(resolvedAvailability\.includedGuests\)/);
  assert.match(search, /quotedGuests: guests/);
  assert.doesNotMatch(home, /forGuests:\s*["'](?:עבור|for|для|pour) 2/);
  assert.match(search, /selectedStay=\{selectedStayFor\(property\.slug\)\}/);
  assert.match(home, /selectedStay=\{\{ from: deal\.from, till: deal\.till, guests: deal\.priceGuests \}\}/);
  assert.match(holiday, /selectedStay=\{\{ from: deal\.from, till: deal\.till, guests: deal\.priceGuests \}\}/);
});
