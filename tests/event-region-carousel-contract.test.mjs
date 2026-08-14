import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../app/events/page.tsx", import.meta.url), "utf8");
const component = await readFile(new URL("../app/components/event-region-carousel.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
const translations = JSON.parse(await readFile(new URL("../app/data/event-region-carousel-translations.json", import.meta.url), "utf8"));

test("event regions use matching public inventory for truthful imagery and counts", () => {
  assert.match(page, /eventPlaces\.filter\(\(place\) => place\.area === label \|\| place\.location === label\)/);
  assert.match(page, /matchingPlaces\.find\(\(place\) => !usedImages\.has\(place\.image\)\)/);
  assert.match(page, /venueCount: matchingPlaces\.length/);
  assert.match(page, /href: `\/events\/search\?location=\$\{encodeURIComponent\(label\)\}`/);
  assert.match(page, /<EventRegionCarousel items=\{regions\} \/>/);
});

test("event region carousel has usable controls, links and localized direction", () => {
  assert.match(component, /data-horizontal-rail/);
  assert.match(component, /scrollIntoView\(\{ behavior: "smooth", block: "nearest", inline: "start" \}\)/);
  assert.match(component, /type="button"[\s\S]{0,180}disabled=\{activeIndex === 0\} aria-label=\{copy\.previous\}/);
  assert.match(component, /type="button"[\s\S]{0,180}disabled=\{activeIndex === items\.length - 1\} aria-label=\{copy\.next\}/);
  assert.match(component, /dir=\{isRtl \? "rtl" : "ltr"\}/);
  assert.match(component, /aria-label=\{`\$\{label\}, \$\{countLabel\}`\}/);
});

test("event region carousel copy is complete in every public language", () => {
  for (const values of Object.values(translations)) {
    for (const language of ["he", "en", "ru", "fr"]) assert.ok(values[language]);
  }
  assert.match(component, /carouselText\("previous", language\)/);
  assert.match(component, /venueCountLabel\(item\.venueCount, language\)/);
});

test("event region carousel is media-led, snap-scrolling and mobile-safe", () => {
  assert.match(css, /\.event-region-carousel__rail \{[^}]*grid-auto-flow: column[^}]*overflow-x: auto[^}]*scroll-snap-type: inline mandatory/);
  assert.match(css, /\.event-region-carousel__card \{[^}]*min-height: 338px[^}]*border-radius: 28px/);
  assert.match(css, /\.event-region-carousel__card img \{[^}]*object-fit: cover/);
  assert.match(css, /@media \(max-width: 820px\)[\s\S]*\.event-region-carousel \{ --event-region-card-size: min\(78vw,310px\)/);
  assert.doesNotMatch(css, /\.event-region-carousel__rail[^}]*overflow-x: hidden/);
});
