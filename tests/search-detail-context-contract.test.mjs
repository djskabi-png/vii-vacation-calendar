import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const search = readFileSync(new URL("../app/search/page.tsx", import.meta.url), "utf8");
const card = readFileSync(new URL("../app/components/property-card.tsx", import.meta.url), "utf8");
const map = readFileSync(new URL("../app/components/listing-map.tsx", import.meta.url), "utf8");
const businessPage = readFileSync(new URL("../app/business/page.tsx", import.meta.url), "utf8");
const business = readFileSync(new URL("../app/business/client-page.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("search result links preserve the selected stay context", () => {
  for (const key of ["source", "dates", "from", "till", "guests", "rooms"]) {
    assert.match(search, new RegExp(`params\\.set\\("${key}"`));
  }
  assert.match(search, /detailHref=\{detailHref\(property\.slug\)\}/);
  assert.match(search, /detailQuery=\{detailQuery\}/);
  assert.match(card, /const propertyHref = detailHref \|\|/);
  assert.match(map, /detailQuery \? `&\$\{detailQuery\}` : ""/);
});

test("business detail shows the preserved search before availability", () => {
  assert.match(businessPage, /initialRooms=\{params\.rooms\}/);
  assert.match(businessPage, /initialSource=\{params\.source\}/);
  assert.match(business, /initialSource === "search"/);
  assert.match(business, /className="search-context-summary shell"/);
  assert.match(business, /החיפוש שבחרתם/);
  assert.match(business, /בדיקת זמינות לחיפוש הזה/);
});

test("the nightly price is a stable RTL-aware inline group", () => {
  assert.match(css, /\.stay-card__price \{ display: inline-flex;/);
  assert.match(css, /\.stay-card__price b \{[^}]*white-space: nowrap;/);
  assert.doesNotMatch(css, /\.stay-card__price b \{[^}]*text-decoration: underline/);
});