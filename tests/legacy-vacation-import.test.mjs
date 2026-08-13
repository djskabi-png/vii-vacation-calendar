import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");

test("verified legacy vacation profiles keep complete content, reviews and commercial states", async () => {
  const profiles = await readFile(resolve(root, "app/data/legacy-vacation-profiles.ts"), "utf8");
  const siteData = await readFile(resolve(root, "app/data/site-data.ts"), "utf8");
  const card = await readFile(resolve(root, "app/components/property-card.tsx"), "utf8");
  const reviewStudio = await readFile(resolve(root, "app/components/guest-review-studio.tsx"), "utf8");

  for (const slug of [
    "vacation-vila-harel",
    "vacation-villa-esem-harimon",
    "vacation-gesthouse-royal",
    "vacation-villa-yotam",
    "vacation-villa-circle",
  ]) {
    assert.match(profiles, new RegExp(`"${slug}"`));
    assert.match(card, new RegExp(`"${slug}"`));
  }

  assert.match(profiles, /verifiedStartingPrice: 1100/);
  assert.match(profiles, /verifiedStartingPrice: 3900/);
  assert.match(profiles, /sourceUrl: "https:\/\/www\.vii\.co\.il\//);
  assert.match(profiles, /checkedAt: "2026-08-13"/);
  assert.match(siteData, /reviewHighlights: legacyProfile\?\.reviews/);
  assert.match(siteData, /featureGroups: legacyProfile\?\.featureGroups/);
  assert.match(reviewStudio, /publishedReviews\.map/);
  assert.match(reviewStudio, /תמצית חוות דעת מאומתת מארכיון VII/);
  assert.match(card, /"vacation-villa-esem-harimon": "available-price"/);
  assert.match(card, /"vacation-gesthouse-royal": "price-only"/);
  assert.match(card, /"vacation-vila-harel": "available-no-price"/);
  assert.match(card, /"vacation-villa-yotam": "no-data"/);
  assert.match(card, /"vacation-villa-circle": "unavailable"/);
});

test("legacy review summaries are localized and never presented as quotations", async () => {
  const profiles = await readFile(resolve(root, "app/data/legacy-vacation-profiles.ts"), "utf8");
  const translations = JSON.parse(await readFile(resolve(root, "app/data/legacy-vacation-ui-translations.json"), "utf8"));
  assert.doesNotMatch(profiles, /quote:/);
  assert.match(profiles, /summary: copy\(/);
  for (const values of Object.values(translations)) {
    assert.ok(values.en && values.ru && values.fr);
    assert.doesNotMatch(values.en + values.ru + values.fr, /[\u0590-\u05ff]/);
  }
});
