import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const page = await readFile(new URL("../app/business/client-page.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

test("the place favorite is a compact overlay on the gallery image", () => {
  assert.match(page, /className="shell property-gallery-wrap"/);
  assert.match(page, /<FavoriteButton compact className="property-gallery__favorite"/);
  assert.doesNotMatch(page, /property-title__actions">\s*<FavoriteButton/);
  assert.match(css, /\.property-gallery-wrap > \.property-gallery__favorite \{ position: absolute;/);
});

test("mobile place contact actions stay in one refined row", () => {
  assert.match(css, /\.property-title__actions \{ display: grid; grid-template-columns: minmax\(96px, \.92fr\) 44px minmax\(132px, 1\.2fr\);/);
  assert.match(css, /\.property-title__actions \.property-phone-action \{ grid-column: 1; grid-row: 1; \}/);
  assert.match(css, /\.property-title__actions \.share-trigger \{ grid-column: 2; grid-row: 1;/);
  assert.match(css, /\.property-title__actions \.property-whatsapp-action \{ grid-column: 3; grid-row: 1;/);
  assert.doesNotMatch(css, /\.property-title__actions \.property-whatsapp-action \{ grid-column: 1 \/ -1; grid-row: 2;/);
});

test("the contact row does not look like one enclosing button", () => {
  const contactRail = css.slice(css.indexOf("/* Business contact actions stay together"), css.indexOf("/* Keep the review transition"));
  assert.match(contactRail, /max-width: 420px;/);
  assert.match(contactRail, /\.property-title__actions--contact \{[\s\S]*gap: 8px;[\s\S]*padding: 0;[\s\S]*border: 0;[\s\S]*background: transparent;[\s\S]*box-shadow: none;/);
  assert.match(contactRail, /\.property-title__actions--contact > button,[\s\S]*border: 1px solid rgba\(18,50,61,\.1\);[\s\S]*border-radius: 14px;[\s\S]*background: #fff;/);
  assert.match(contactRail, /\.property-title__actions--contact \.property-whatsapp-action \{[\s\S]*background: #f1faf6;/);
});

test("phone share and WhatsApp controls remain wired", () => {
  assert.match(page, /onClick=\{\(\) => setPhoneRevealed\(true\)\}/);
  assert.match(page, /<ShareButton title=\{property\.name\} \/>/);
  assert.match(page, /<WhatsAppLeadButton[\s\S]*buttonClassName="property-whatsapp-action"/);
});
