import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../app/components/home-showcase.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("homepage keeps the requested discovery sliders before the next world", () => {
  assert.match(source, />חיפושים נפוצים</);
  assert.match(source, />מה אתם מחפשים\?</);
  assert.match(source, />סרטונים מובילים</);
  assert.match(source, />חוות דעת מובילות</);
  assert.ok(source.indexOf("home-trust-discovery") < source.indexOf("home-spa-strip"));
});

test("home tours use verified media with an honest disclosure", () => {
  assert.match(source, /properties\.flatMap\(\(property\) => \(property\.videos \|\| \[\]\)/);
  assert.match(source, /<video controls playsInline preload="metadata"/);
  assert.match(source, /\{video\.note\}/);
  assert.match(source, /href=\{`\/business\?id=\$\{property\.slug\}`\}/);
});

test("home ratings use sourced values and every slider remains responsive", () => {
  assert.match(source, /filter\(\(item\) => item\.rating\)/);
  assert.match(source, /הדירוג מוצג לפי מקור המידע המאומת של המקום/);
  assert.match(source, /href=\{`\/discover\/place\/\$\{item\.id\}`\}/);
  assert.match(source, /home-rating-card__top/);
  assert.match(source, />לפרטי המקום</);
  assert.match(styles, /\.home-slider__track--trust \.home-slider__item \{ flex-basis: clamp/);
  assert.match(styles, /\.home-slider__track--ratings \.home-slider__item \{ flex-basis: calc\(\(100% - 60px\) \/ 4\); \}/);
  assert.match(styles, /\.home-rating-card__top > img \{ width: 84px; aspect-ratio: 1;/);
  assert.match(styles, /\.home-slider__track--trust \.home-slider__item \{ flex-basis: calc\(100vw - 48px\); \}/);
});
