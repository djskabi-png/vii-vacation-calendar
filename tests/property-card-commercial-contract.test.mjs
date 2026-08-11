import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const card = await readFile(new URL("../app/components/property-card.tsx", import.meta.url), "utf8");
const data = await readFile(new URL("../app/data/site-data.ts", import.meta.url), "utf8");
const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
const analytics = await readFile(new URL("../app/lib/analytics.ts", import.meta.url), "utf8");

function propertyBlock(slug) {
  const start = data.indexOf(`slug: "${slug}"`);
  assert.notEqual(start, -1, `missing property ${slug}`);
  const end = data.indexOf("\n  },", start);
  return data.slice(start, end);
}

test("listing cards expose only verified commercial fields", () => {
  assert.match(card, /property\.score && property\.reviews/);
  assert.match(card, /property\.contact\?\.phone/);
  assert.match(card, /href=\{`tel:\$\{phone\}`\}/);
  assert.doesNotMatch(card, /href=\{`https:\/\/wa\.me/);
  assert.match(card, /<WhatsAppLeadButton/);
  assert.match(card, /buttonClassName="stay-card__contact stay-card__contact--whatsapp"/);
  assert.match(card, /setPhoneVisible\(true\)/);
  assert.match(card, /trackPhoneReveal/);
  assert.match(card, /property\.price \?/);
});

test("recommended cards omit booking price copy and keep a measured reveal action", () => {
  assert.match(card, /promotional = false/);
  assert.match(card, /!promotional && resolvedAvailability \? <div className="stay-card__date-status"/);
  assert.match(card, /!promotional \? <div className="stay-card__commercial-summary">/);
  assert.match(card, /const cardMode = promotional \? "promotional" : resolvedAvailability \? "dated" : "result"/);
  assert.match(card, /!promotional && whatsapp \? <WhatsAppLeadButton/);
  assert.match(card, /phoneCopy\[language\]\.reveal/);
  assert.match(analytics, /event: "vii_phone_reveal"/);
  assert.match(analytics, /vii-cookie-choice/);
  assert.match(analytics, /window\.dataLayer\.push\(eventDetails\)/);
});

test("verified legacy facts are attached only to their matching properties", () => {
  const ahuzatOr = propertyBlock("ahuzat-or");
  assert.match(ahuzatOr, /score: 10/);
  assert.match(ahuzatOr, /reviews: 8/);
  assert.match(ahuzatOr, /price: 950/);
  assert.match(ahuzatOr, /phone: "052-9170990"/);

  const perfumes = propertyBlock("perfumes-villa");
  assert.match(perfumes, /score: 9\.6/);
  assert.match(perfumes, /reviews: 36/);
  assert.match(perfumes, /price: 5000/);
  assert.match(perfumes, /phone: "055-4538221"/);

  const aqua = propertyBlock("aqua-resort");
  assert.match(aqua, /phone: "055-4500077"/);
  assert.doesNotMatch(aqua, /score:|reviews:|price:/);
});

test("compact card actions remain usable on mobile and keyboard", () => {
  assert.match(css, /\.stay-card__contact \{[^}]*min-height: 44px/);
  assert.match(css, /\.stay-card__contact:focus-visible/);
  assert.match(css, /\.stay-card__actions \{ width: 100%; grid-template-columns: repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /\.stay-card__contact svg \{ flex: 0 0 auto; width: 19px; height: 19px; stroke-width: 2\.25/);
  assert.match(css, /\.stay-card__contact span \{ display: inline; \}/);
  assert.match(css, /\.stay-card__details-link \{ grid-column: 1 \/ -1; width: 100%; min-height: 48px/);
  assert.match(card, /aria-label=\{`\$\{phoneCopy\[language\]\.call\}: \$\{property\.name\}`\}/);
  assert.doesNotMatch(card, /className="button secondary"/);
  assert.match(card, /<PriceValue amount=\{property\.price\.toLocaleString\(\)\} language=\{language\} \/>/);
  assert.match(card, /className="stay-card__price-value"/);
  assert.match(css, /\.stay-card__currency \{[^}]*font-size: \.68em/);
});

test("rating accessibility copy is localized in every supported language", () => {
  assert.match(card, /outOfTen: "מתוך 10"/);
  assert.match(card, /outOfTen: "out of 10"/);
  assert.match(card, /outOfTen: "из 10"/);
  assert.match(card, /outOfTen: "sur 10"/);
  assert.match(card, /copy\.outOfTen/);
});
