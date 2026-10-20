import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("hourly cards use one stretched place link and keep contacts separate", async () => {
  const card = await read("app/components/discovery-card.tsx");
  const styles = await read("app/globals.css");
  assert.doesNotMatch(card, /className="discovery-card__details"/);
  assert.match(card, /className="discovery-card__stretched-link"/);
  assert.match(card, /target\.closest\("a,button,input,select,textarea,\[role='button'\]"\)/);
  assert.match(card, /router\.push\(detailsHref\)/);
  assert.match(card, /<CardContactActions[^>]+world="hourly"/s);
  assert.doesNotMatch(styles, /\.discovery-card__stretched-link::after[^}]+inset:0/s);
  const protectedControls = styles.match(/\.discovery-card :is\(([^)]*)\)[^{]*\{[^}]*z-index:2/s)?.[1] || "";
  assert.match(protectedControls, /\.preview-card-gallery/);
  assert.match(protectedControls, /\.favorite-button/);
  assert.match(protectedControls, /\.card-contact-actions/);
  assert.doesNotMatch(protectedControls, /\.discovery-card__chips|\.discovery-card__hourly-footer/);
});

test("hourly detail breadcrumbs include a valid regional landing in UI and schema", async () => {
  const client = await read("app/discover/place/client-page.tsx");
  const page = await read("app/discover/place/[id]/page.tsx");
  const landings = await read("app/data/world-search-landings.ts");
  assert.match(landings, /export function hourlyBreadcrumbForLocation/);
  assert.match(client, /hourlyBreadcrumbForLocation\(item\.area, item\.location\)/);
  assert.match(page, /breadcrumbSchema\(itemBreadcrumbs\)/);
  assert.match(page, /hourlyBreadcrumbForLocation\(item\.area, item\.location\)/);
});

test("hourly detail groups rooms, verified rates and amenities into polished sections", async () => {
  const client = await read("app/discover/place/client-page.tsx");
  const styles = await read("app/globals.css");
  for (const marker of ["hourly-overview", "hourly-room-grid", "hourly-room-card", "hourly-contact-card", "hourly-feature-grid"]) {
    assert.match(client, new RegExp(marker));
    assert.match(styles, new RegExp(`\\.${marker}`));
  }
  assert.match(client, /details\.rates\.filter\(\(rate\) => rate\.duration\.startsWith/);
  assert.doesNotMatch(client, /מה אומרים בשיחה\?/);
});
