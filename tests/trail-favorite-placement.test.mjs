import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../app/trails/[slug]/page.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

test("trail detail keeps one favorite action in the hero image wrapper", () => {
  assert.equal((page.match(/<FavoriteButton/g) || []).length, 1);
  assert.match(page, /<div className="trail-detail__visual-wrap"><FavoriteButton className="trail-detail__favorite"[\s\S]*?<TrailVisual trail=\{trail\} showCredit \/><\/div>/);
  const titleRow = page.match(/<div className="trail-detail__title-row">([\s\S]*?)<\/div>/)?.[1] ?? "";
  assert.doesNotMatch(titleRow, /FavoriteButton/);
});

test("trail favorite uses the shared logical image corner at desktop and mobile", () => {
  assert.match(css, /\.trail-detail__visual-wrap \{ position: relative; min-width: 0; \}/);
  assert.match(css, /\.trail-detail__favorite \{ position: absolute; z-index: 5; top: calc\(25px \+ 16px\); inset-inline-end: calc\(25px \+ 16px\);/);
  assert.match(css, /\.trail-detail__favorite \{ top: calc\(25px \+ 12px\); inset-inline-end: calc\(25px \+ 12px\); \}/);
});
