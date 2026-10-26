import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("shared world pages follow search, breadcrumbs, heading, results order", async () => {
  const source = await readFile(new URL("../app/components/world-landing.tsx", import.meta.url), "utf8");
  const search = source.indexOf('className="world-hero"');
  const breadcrumbs = source.indexOf('className="world-breadcrumbs"');
  const heading = source.indexOf('className="world-page-heading shell"');
  const results = source.indexOf('className="section shell"');

  assert.ok(search >= 0 && search < breadcrumbs);
  assert.ok(breadcrumbs < heading);
  assert.ok(heading < results);
  assert.match(source, /<SearchBox mode=\{searchMode\} compact showWorlds/);
});

test("events landing follows the same page hierarchy", async () => {
  const source = await readFile(new URL("../app/events/page.tsx", import.meta.url), "utf8");
  const hero = source.indexOf('className="events-hero"');
  const breadcrumbs = source.indexOf('className="events-hero__breadcrumbs"');
  const heading = source.indexOf("<h1>{presentation.title}</h1>");
  const search = source.indexOf('<SearchBox mode="events" compact showWorlds');
  const quickSearches = source.indexOf("<EventQuickSearches");
  const results = source.indexOf('className="section shell event-region-section"');

  assert.ok(hero >= 0 && hero < breadcrumbs);
  assert.ok(breadcrumbs < heading);
  assert.ok(heading < search);
  assert.ok(search < quickSearches && quickSearches < results);
  assert.match(source, /<SearchBox mode="events" compact showWorlds/);
});

test("trails and attractions expose a working search entry before breadcrumbs and heading", async () => {
  for (const file of ["trails/page.tsx", "attractions/page.tsx"]) {
    const source = await readFile(new URL(`../app/${file}`, import.meta.url), "utf8");
    const search = source.indexOf("<SpecialWorldSearch");
    const breadcrumbs = source.indexOf('className="world-breadcrumbs"');
    const heading = Math.min(...[source.indexOf('className="trails-hero"'), source.indexOf('className="attractions-hero"')].filter((index) => index >= 0));
    assert.ok(search >= 0 && search < breadcrumbs);
    assert.ok(breadcrumbs < heading);
    assert.match(source, /<SpecialWorldSearch active="(?:trails|attractions)" targetId="(?:trail|attraction)-search"/);
    assert.doesNotMatch(source, /className="special-search-summary" href="#/);
  }
});

test("special world search opens in place before offering an explicit local-filter jump", async () => {
  const source = await readFile(new URL("../app/components/special-world-search.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.doesNotMatch(source, /^"use client";/);
  assert.match(source, /<details className="special-search-disclosure">/);
  assert.match(source, /<summary className="special-search-summary"/);
  assert.match(source, /<SearchWorldTabs active=\{active\} \/>/);
  assert.match(source, /className="special-search-local" href=\{`#\$\{targetId\}`\}/);
  assert.match(styles, /\.special-search-panel/);
  assert.match(styles, /\.special-search-disclosure > summary:focus-visible/);
  assert.match(styles, /@media \(max-width: 560px\)[\s\S]*\.special-search-summary \{ min-height: 60px; padding: 7px 18px;/);
});
