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
  const search = source.indexOf('className="events-hero"');
  const breadcrumbs = source.indexOf('className="world-breadcrumbs"');
  const heading = source.indexOf('className="world-page-heading shell"');
  const results = source.indexOf('className="section shell event-region-section"');

  assert.ok(search >= 0 && search < breadcrumbs);
  assert.ok(breadcrumbs < heading);
  assert.ok(heading < results);
  assert.match(source, /<SearchBox mode="events" compact showWorlds/);
});

test("trails and attractions expose a working search entry before breadcrumbs and heading", async () => {
  for (const file of ["trails/page.tsx", "attractions/page.tsx"]) {
    const source = await readFile(new URL(`../app/${file}`, import.meta.url), "utf8");
    const search = source.indexOf('className="special-search-rail"');
    const breadcrumbs = source.indexOf('className="world-breadcrumbs"');
    const heading = Math.min(...[source.indexOf('className="trails-hero"'), source.indexOf('className="attractions-hero"')].filter((index) => index >= 0));
    assert.ok(search >= 0 && search < breadcrumbs);
    assert.ok(breadcrumbs < heading);
    assert.match(source, /className="special-search-summary" href="#(?:trail|attraction)-search"/);
  }
});
