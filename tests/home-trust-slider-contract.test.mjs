import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../app/components/home-showcase.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("homepage keeps the requested discovery sliders before the next world", () => {
  assert.match(source, /יעדים מומלצים לנופש/);
  assert.match(source, /destinationImages.filter/);
  assert.match(source, /usedDestinationImages/);
  assert.match(source, /featuredTours.length \?/);
  assert.match(source, />סרטונים מובילים</);
  assert.match(source, />חוות דעת מובילות</);
  assert.ok(source.indexOf("home-trust-discovery") < source.indexOf("<SpaPackageDeals />"));
});

test("home tours use verified media with an honest disclosure", () => {
  assert.match(source, /properties\.flatMap\(\(property\) => homeTourVideos\(property\.videos\)/);
  assert.match(source, /<video controls playsInline preload="none"/);
  assert.match(source, /\{video\.note\}/);
  assert.match(source, /href=\{`\/business\?id=\$\{property\.slug\}`\}/);
});

test("home ratings use sourced values, clean excerpts and responsive cards", () => {
  const home = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(home, /publicCatalogReviewPreviews<SupplierReviewDetail>\("vacations", candidates\.map/);
  assert.match(home, /Number\(place\.reviews\) >= 5/);
  assert.match(source, /homeReviewExcerpt\(reviewText\)/);
  assert.match(source, /ratedPlaces\.length \?/);
  assert.doesNotMatch(source, /הדירוג מוצג לפי מקור המידע המאומת של המקום/);
  assert.doesNotMatch(styles, /\.home-rating-card > p[^}]*-webkit-line-clamp/);
  assert.match(source, /href=\{`\/business\?id=\$\{place\.slug\}`\}/);
  assert.match(source, /home-rating-card__top/);
  assert.match(source, />לפרטי המקום</);
  assert.match(styles, /\.home-slider__track--trust \.home-slider__item \{ flex-basis: clamp/);
  assert.match(styles, /\.home-slider__track--ratings \.home-slider__item \{ flex-basis: calc\(\(100% - 60px\) \/ 4\); \}/);
  assert.match(styles, /@media \(min-width: 561px\) and \(max-width: 1000px\)[\s\S]*\.home-slider__track--ratings \.home-slider__item \{ flex-basis: calc\(\(100% - 20px\) \/ 2\); \}/);
  assert.match(styles, /\.home-rating-card__top > \.home-rating-card__gallery \{[^}]*width: 84px; height: 84px;/);
  assert.match(source, /className="home-rating-card__gallery"/);
  assert.match(styles, /\.home-slider__track--trust \.home-slider__item \{ flex-basis: calc\(100vw - 48px\); \}/);
});
