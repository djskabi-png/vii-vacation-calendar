import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("vacation search keeps machine-readable arrival and departure dates", async () => {
  const source = await readFile(new URL("app/components/search-box.tsx", root), "utf8");
  assert.match(source, /setVacationDateRange\(\{ from: result\.checkIn, till: result\.checkOut \}\)/);
  assert.match(source, /params\.set\("from", vacationDateRange\.from\)/);
  assert.match(source, /params\.set\("till", vacationDateRange\.till\)/);
});

test("result cards support verified price and all availability states", async () => {
  const card = await readFile(new URL("app/components/property-card.tsx", root), "utf8");
  const data = await readFile(new URL("app/data/site-data.ts", root), "utf8");
  const search = await readFile(new URL("app/search/page.tsx", root), "utf8");

  assert.match(data, /type ListingAvailability = "available" \| "unavailable" \| "unknown"/);
  assert.match(data, /nightlyPrice\?: number/);
  assert.match(data, /includedGuests\?: number/);
  assert.match(card, /quote\.from === selectedStay\.from && quote\.till === selectedStay\.till/);
  assert.match(card, /availability: "unknown"/);
  assert.match(card, /hasQuotedPrice = Boolean\(resolvedAvailability\?\.nightlyPrice\)/);
  assert.match(card, /!promotional && \(resolvedAvailability \|\| property\.price\)/);
  assert.doesNotMatch(card, /: copy\.datePrice/);
  assert.match(card, /פנה למתחם לבירור מחיר/);
  assert.match(card, /פנוי בתאריכים שנבחרו/);
  assert.match(card, /לא פנוי בתאריכים שנבחרו/);
  assert.match(card, /זמינות: לא עודכן/);
  assert.doesNotMatch(card, /includedGuests\s*\|\|\s*property\.guests/);
  assert.match(search, /selectedStay=\{selectedStay\}/);
});

test("selected-date card copy is localized in every supported language", async () => {
  const card = await readFile(new URL("app/components/property-card.tsx", root), "utf8");
  for (const phrase of [
    "Contact the property for a price",
    "Availability not updated",
    "Уточните цену у объекта",
    "Наличие не обновлено",
    "Contactez l'établissement pour connaître le prix",
    "Disponibilité non mise à jour",
  ]) assert.match(card, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});
