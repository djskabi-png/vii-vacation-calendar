import { readEffectiveWorldCss } from "./helpers/world-css.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../app/components/home-showcase.tsx", import.meta.url), "utf8");
const styles = readEffectiveWorldCss();

test("homepage keeps the requested discovery sliders before the next world", () => {
  assert.match(source, /יעדים מומלצים לנופש/);
  assert.match(source, /vacationDestinations\.map\(\(item\)/);
  assert.match(source, /src=\{item\.image\}/);
  assert.match(source, /featuredTours.length \?/);
  assert.match(source, />סרטונים מובילים</);
  assert.match(source, />חוות דעת מובילות</);
  assert.ok(source.indexOf("home-trust-discovery") < source.indexOf("<SpaPackageDeals"));
});

test("homepage always shows five approved vacation destinations without transactional parameters", () => {
  for (const [label, href] of [
    ["נופש בצפון", "/vacations/north"],
    ["נופש בכנרת", "/vacations/kinneret"],
    ["נופש במרכז", "/vacations/center"],
    ["נופש באזור ירושלים", "/vacations/jerusalem"],
    ["נופש באילת", "/vacations/eilat"],
  ]) {
    assert.match(source, new RegExp(`label: "${label}"[^\\n]+href: "${href}"`));
  }
  assert.equal((source.match(/label: "נופש ב(?:צפון|כנרת|מרכז|אזור ירושלים|אילת)"/g) || []).length, 5);
  assert.doesNotMatch(source, /href: "\/vacations\/(?:north|kinneret|center|jerusalem|eilat)\?[^\"]+/);
  assert.match(source, /src=\{item\.image\}/);
  assert.doesNotMatch(source, /return place \?/);
});

test("home tours use verified media with an honest disclosure", () => {
  assert.match(source, /eligibleHomeTourProperties\(properties\)\.flatMap\(\(property\) => homeTourVideos\(property\.videos\)/);
  assert.match(source, /<video controls playsInline preload="none"/);
  assert.match(source, /\{video\.note\}/);
  assert.match(source, /href=\{`\/business\?id=\$\{property\.slug\}`\}/);
});

test("home ratings remain available as a component but never block the homepage cold path", () => {
  const home = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(home, /publicCatalogReviewPreviews|HomeRatings|HomeRatingsSection/);
  assert.match(source, /homeReviewExcerpt\(reviewText\)/);
  assert.match(source, /export function HomeRatingsSection/);
  assert.match(source, /if \(!featuredRatings\.length\) return null/);
  assert.doesNotMatch(source, /הדירוג מוצג לפי מקור המידע המאומת של המקום/);
  assert.doesNotMatch(styles, /\.home-rating-card > p[^}]*-webkit-line-clamp/);
  assert.match(source, /href=\{localizedPath\(`\/business\?id=\$\{place\.slug\}`, language\)\}/);
  assert.match(source, /home-rating-card__top/);
  assert.match(source, />לפרטי המקום</);
  assert.match(styles, /\.home-slider__track--trust \.home-slider__item \{ flex-basis: clamp/);
  assert.match(styles, /\.home-slider__track--ratings \.home-slider__item \{ flex-basis: calc\(\(100% - 60px\) \/ 4\); \}/);
  assert.match(styles, /@media \(min-width: 561px\) and \(max-width: 1000px\)[\s\S]*\.home-slider__track--ratings \.home-slider__item \{ flex-basis: calc\(\(100% - 20px\) \/ 2\); \}/);
  assert.match(styles, /\.home-rating-card__top > \.home-rating-card__gallery \{[^}]*width: 112px; height: 112px;/);
  assert.match(source, /className="home-rating-card__gallery"/);
  assert.match(styles, /\.home-slider__track--trust \.home-slider__item \{ flex-basis: calc\(100vw - 48px\); \}/);
});
