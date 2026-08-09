import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("homepage cards reserve separate zones for labels and content", async () => {
  const css = await readFile(new URL("app/globals.css", root), "utf8");
  assert.match(css, /home-vacation-card--destination > div[^}]*position:\s*absolute[^}]*bottom:\s*0/s);
  assert.match(css, /home-vacation-card--destination > div > span[^}]*margin-bottom:\s*8px/s);
  assert.match(css, /home-vacation-card--destination > div[^}]*padding:\s*76px/s);
});

test("homepage discovery uses complete card compositions", async () => {
  const component = await readFile(new URL("app/components/home-showcase.tsx", root), "utf8");
  assert.doesNotMatch(component, /home-vacation-card--compact/);
  assert.match(component, /home-vacation-card--search/);
  assert.match(component, /home-vacation-card--style/);
});

test("homepage preserves every legacy deal period with a dedicated live search link", async () => {
  const source = await readFile(new URL("../app/components/home-showcase.tsx", import.meta.url), "utf8");
  for (const label of ["ברגע האחרון", "2 לילות חמישי עד שבת", "2 לילות שישי עד ראשון", "פנוי לחמישי", "פנוי לשישי", "אוגוסט", "ראש השנה", "סוכות", "שמחת תורה", "חג הסיגד"]) {
    assert.match(source, new RegExp(label));
  }
  assert.match(source, /function lastMinuteHref/);
  assert.match(source, /<nav className="home-last-minute__tabs"/);
  assert.match(source, /<Link key=\{period\.id\} href=\{lastMinuteHref\(period\)\}>/);
  assert.doesNotMatch(source, /href=\{lastMinuteHref\(period\)\}[^>]*preventDefault/);
  assert.match(source, /selectedLastMinutePeriod\.cta/);
});

test("homepage commercial cards include visible semantic artwork", async () => {
  const page = await readFile(new URL("app/page.tsx", root), "utf8");
  assert.match(page, /GiftIcon/);
  assert.match(page, /PeopleIcon/);
  assert.equal((page.match(/home-corporate-gift__visual/g) || []).length, 2);
});

test("ordinary homepage sections share the compact spacing contract", async () => {
  const css = await readFile(new URL("app/globals.css", root), "utf8");
  for (const selector of ["home-recommended", "home-last-minute", "home-vacation-discovery", "home-spa-strip", "home-short-stay", "home-corporate-gift"]) {
    assert.match(css, new RegExp(`\\.${selector}[^}]*padding-block:\\s*64px`));
  }
  assert.match(css, /@media \(max-width:\s*760px\)[\s\S]*home-corporate-gift[^}]*padding-block:\s*48px/);
});

test("spa landing links use illustrated choice tiles and a branded location card", async () => {
  const component = await readFile(new URL("app/components/world-map-results.tsx", root), "utf8");
  const css = await readFile(new URL("app/globals.css", root), "utf8");
  assert.match(component, /function SpaFilterIcon/);
  for (const id of ["hotel", "boutique", "pool", "jacuzzi", "sauna", "gym", "couples", "day-pass"]) {
    assert.match(component, new RegExp(`id === "${id}"`));
  }
  assert.match(component, /spa-results__location-card/);
  assert.match(component, /spa-results__filter-icon/);
  assert.match(component, /spa-results__filter-label/);
  assert.match(css, /spa-results__landing-links > div[^}]*grid-template-columns:\s*repeat\(9/);
  assert.match(css, /spa-results__filter-icon[^}]*border-radius:\s*50%/);
  assert.match(css, /spa-results__location-icon[^}]*border-radius:\s*50%/);
});
