import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const card = await readFile(new URL("../app/components/property-card.tsx", import.meta.url), "utf8");
const data = await readFile(new URL("../app/data/site-data.ts", import.meta.url), "utf8");
const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

function propertyBlock(slug) {
  const start = data.indexOf(`slug: "${slug}"`);
  assert.notEqual(start, -1, `missing property ${slug}`);
  const end = data.indexOf("\n  },", start);
  return data.slice(start, end);
}

test("listing cards expose only verified commercial fields", () => {
  assert.match(card, /property\.score && property\.reviews/);
  assert.match(card, /property\.contact\?\.phone/);
  assert.match(card, /property\.contact\?\.whatsapp/);
  assert.match(card, /href=\{`tel:\$\{phone\}`\}/);
  assert.match(card, /https:\/\/wa\.me\/\$\{whatsapp\}/);
  assert.match(card, /property\.price \?/);
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
  assert.match(css, /\.stay-card__contact \{[^}]*min-height: 38px/);
  assert.match(css, /\.stay-card__contact:focus-visible/);
  assert.match(css, /\.stay-card__contact \{ width: 44px; min-width: 44px; height: 44px; min-height: 44px/);
  assert.match(css, /\.stay-card__contact svg \{ width: 20px; height: 20px; stroke-width: 2\.25/);
  assert.match(css, /\.stay-card__contact--whatsapp \{[^}]*background: #20a75a/);
  assert.match(css, /\.stay-card__contact span \{ display: none; \}/);
  assert.match(card, /aria-label=\{`\$\{copy\.call\}: \$\{property\.name\}`\}/);
  assert.match(card, /aria-label=\{`\$\{copy\.whatsapp\}: \$\{property\.name\}`\}/);
  assert.doesNotMatch(card, /className="button secondary"/);
});

test("rating accessibility copy is localized in every supported language", () => {
  assert.match(card, /outOfTen: "מתוך 10"/);
  assert.match(card, /outOfTen: "out of 10"/);
  assert.match(card, /outOfTen: "из 10"/);
  assert.match(card, /outOfTen: "sur 10"/);
  assert.match(card, /copy\.outOfTen/);
});
