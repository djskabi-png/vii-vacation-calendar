import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { quotedPriceGuestCount, quotedPriceGuestLabel, priceBasisGuestLabel } from "../app/lib/quoted-price-guests.ts";
import ts from "typescript";

test("a verified eight-guest base price does not masquerade as a two-guest basis", () => {
  assert.equal(priceBasisGuestLabel("he", 8, 2, true), "המחיר הבסיסי כולל עד 8 אורחים");
  for (const language of ["en", "ru", "fr"]) assert.ok(priceBasisGuestLabel(language, 8, 2, true).includes("8"));
  for (const [basis, requested, priced] of [[undefined, 2, true], [8, 10, true], [8, 8, true], [8, 2, false], [0, 2, true]]) assert.equal(priceBasisGuestLabel("he", basis, requested, priced), null);
});

test("actual shared home/holiday offer adapter preserves both quote party and supplier basis", async () => {
  const source = await readFile(new URL("../app/components/home-live-deals.tsx", import.meta.url), "utf8");
  const ast = ts.createSourceFile("home.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const fn = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "dealAvailability");
  const code = ts.transpileModule(fn.getText(ast).replace("export ", ""), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const adapt = Function(code + ";return dealAvailability;")();
  const value = adapt({ from: "2026-11-12", till: "2026-11-13", total: 1500, nights: 1, priceGuests: 2, priceBasisGuests: 8, roomID: 3728 });
  assert.equal(value.quotedGuests, 2); assert.equal(value.priceBasisGuests, 8); assert.equal(value.totalPrice, 1500);
});

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
