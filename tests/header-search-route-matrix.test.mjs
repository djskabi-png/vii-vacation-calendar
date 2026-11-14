import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { hasInPageSearchSurface } from "../app/lib/header-search-visibility.ts";

const inPageSearchRoutes = [
  "/",
  "/search",
  "/search/vacations/pool",
  "/vacations/center",
  "/vacations/near-me",
  "/vacations/search/north",
  "/villas",
  "/villas/north",
  "/zimmers/center",
  "/wood-cabins/south-negev",
  "/events",
  "/events/search/center",
  "/events/search/center/lofts",
  "/events/near-me",
  "/spas",
  "/spas/near-me",
  "/spas/search/center",
  "/spas/spa-with-pool",
  "/hourly",
  "/hourly/near-me",
  "/hourly/search/center",
  "/providers",
  "/providers/photographers",
  "/providers/near-me",
  "/guides",
  "/attractions",
  "/attractions/explore/family",
  "/attractions/near-me",
  "/trails",
  "/trails/explore/water",
  "/trails/near-me",
];

const standaloneRoutes = [
  "/business",
  "/events/place/rose-gold",
  "/events/friday",
  "/events/thursday",
  "/events/last-minute",
  "/spas/today",
  "/spas/tomorrow",
  "/spas/day/sunday",
  "/trails/banias",
  "/discover/place/spa-25",
  "/guides/article/example",
  "/holidays",
  "/account",
  "/legal/privacy",
];

test("every route family with an in-page search suppresses the header shortcut", () => {
  for (const route of inPageSearchRoutes) assert.equal(hasInPageSearchSurface(route), true, route);
});
test("detail, deal and editorial routes without an in-page search keep the shortcut", () => {
  for (const route of standaloneRoutes) assert.equal(hasInPageSearchSurface(route), false, route);
});

test("visibility is a synchronous pathname decision with no DOM or effect fallback", async () => {
  const [header, visibility] = await Promise.all([
    readFile(new URL("../app/site-header.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/header-search-visibility.ts", import.meta.url), "utf8"),
  ]);
  assert.match(header, /const hasInPageSearch = hasInPageSearchSurface\(pathname\)/);
  assert.match(header, /!hasInPageSearch \? <button[^>]+className="icon-button header-search"/);
  assert.doesNotMatch(visibility, /useEffect|querySelector|MutationObserver|setTimeout/);
});
