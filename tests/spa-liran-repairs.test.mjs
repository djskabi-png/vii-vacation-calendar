import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { filterSpaSourceAbout } from "../app/lib/spa-about-source.ts";
import { createSourceLoader } from "./helpers/source-module-loader.mjs";
const { getSpaDetails } = createSourceLoader()("app/data/spa-details.ts");

const page = fs.readFileSync(new URL("../app/discover/place/client-page.tsx", import.meta.url), "utf8");
const card = fs.readFileSync(new URL("../app/lib/spa-discovery-card.ts", import.meta.url), "utf8");
const details = fs.readFileSync(new URL("../app/data/spa-details.ts", import.meta.url), "utf8");

test("SPA expanded source omits the summary paragraph", () => {
  assert.deepEqual(filterSpaSourceAbout("עיסוי ומתקנים", ["עיסוי ומתקנים", "עיסוי ומתקנים וארוחת בוקר", "מידע נוסף"]), ["וארוחת בוקר", "מידע נוסף"]);
  assert.deepEqual(filterSpaSourceAbout("עיסוי ומתקנים", ["עיסוי", "ומתקנים", "מידע נוסף"]), ["עיסוי", "ומתקנים", "מידע נוסף"]);
  assert.deepEqual(filterSpaSourceAbout("", ["  מידע נוסף  "]), ["מידע נוסף"]);
  assert.deepEqual(filterSpaSourceAbout("Massage and facilities", ["massage and facilities for couples"]), ["massage and facilities for couples"]);
});

test("SPA summary does not concatenate the full source body that expands below it", () => {
  const details = getSpaDetails("spa-177");
  assert.ok(details.sourceAbout.length > 1);
  assert.notEqual(details.editorialSummary, details.sourceAbout.join("\n\n"));
  assert.equal(filterSpaSourceAbout(details.editorialSummary, details.sourceAbout).length, details.sourceAbout.length);
  assert.match(page, /details\.sourceAbout\?\.length/);
  assert.match(page, /pack\.people === 1/);
});

test("SPA package cards expose an explicit people basis and select the exact package", () => {
  assert.match(page, /מחיר החבילה עבור \$\{pack\.people\} אנשים/);
  assert.match(page, /onClick=\{\(\) => onBook\(pack\)\}/);
  assert.doesNotMatch(page, /role="button" tabIndex=\{0\}/);
});

test("SPA detail gallery preserves source identity while removing duplicate URLs", () => {
  assert.match(page, /const galleryImages = \[\.\.\.new Set\(item\.images\?\.length/);
  assert.doesNotMatch(card, /\.\.\.site\.packages\.map\(\(pack\) => pack\.image\)/);
});

test("SPA detail packages default to cheapest verified package first", () => {
  assert.match(details, /\}\)\)\.sort\(\(a, b\) =>/);
  assert.match(details, /price\(a\.price\) - price\(b\.price\)/);
});

test("SPA detail exposes native share and places reviews before Masso", () => {
  assert.match(page, /item\.world === "spa" \? <ShareButton/);
  assert.ok(page.indexOf("<GuestReviewStudio") < page.indexOf("<MasuExperience"));
});
