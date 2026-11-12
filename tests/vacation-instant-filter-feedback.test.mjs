import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("vacation binary quick filters use the instant URL path and accessible pending feedback", async () => {
  const source = await readFile(new URL("app/search/page.tsx", root), "utf8");
  const binary = source.slice(source.indexOf("function changeBinaryFilter"), source.indexOf("function changeOnlineFilter"));
  assert.match(binary, /updateInstantSearchContext\(key,/);
  assert.doesNotMatch(binary, /router\.(push|replace)/);
  assert.match(source, /aria-busy=\{pendingQuickFilter === "pool" \|\| undefined\}/);
  assert.match(source, /className="quick-filter-spinner"/);
  assert.match(source, /data-quick-filter="pool"/);
  assert.match(source, /pressedControl\?\.setAttribute\("aria-busy", "true"\)/);
  assert.match(source, /event\.currentTarget/);
  assert.match(source, /results-list[^\n]+aria-busy=\{pendingQuickFilter \? "true" : undefined\}/);
  assert.match(source, /window\.history\.pushState\(window\.history\.state, "", nextHref\)/);
  assert.match(source, /window\.scrollTo\(window\.scrollX, preservedScrollY\)/);
  assert.match(source, /removesImplicitLandingDefault/);
  assert.match(source, /window\.requestAnimationFrame\(\(\) => router\.push\(localizedPath\(destination, language\), \{ scroll: false \}\)\)/);
});

test("instant URL builder keeps the route and records neutral overrides for landing defaults", async () => {
  const source = await readFile(new URL("app/lib/instant-search-url.ts", root), "utf8");
  assert.match(source, /return query \? `\$\{pathname\}\?\$\{query\}` : pathname/);
  assert.match(source, /booleanSearchKeys\.has\(key\) \? "0" : ""/);
  assert.match(source, /implicitBooleanDefault/);
  assert.doesNotMatch(source, /router|fetch\(/);
});

test("quick filter styling keeps a visible local spinner and reduced-motion behavior", async () => {
  const css = await readFile(new URL("app/globals.css", root), "utf8");
  assert.match(css, /\.search-quick-filters button\.is-pending/);
  assert.match(css, /\.quick-filter-spinner[\s\S]*border-inline-start-color: transparent/);
  assert.match(css, /button\.is-pending \.quick-filter-spinner \{ display: inline-block; \}/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});
