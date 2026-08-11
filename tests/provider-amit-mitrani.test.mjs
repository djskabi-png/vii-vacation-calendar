import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("provider search toolbar scrolls with the desktop page", async () => {
  const css = await read("../app/globals.css");
  assert.match(css, /\.provider-toolbar \{ position: static;/);
  assert.doesNotMatch(css, /\.provider-toolbar \{ position: sticky;/);
});

test("provider filters use the full toolbar width without an empty desktop grid cell", async () => {
  const [css, component] = await Promise.all([
    read("../app/globals.css"),
    read("../app/components/provider-results.tsx"),
  ]);
  assert.match(component, /className="provider-filter-options"/);
  assert.match(css, /\.provider-filter-options \{ grid-column: 1 \/ -1;/);
  assert.match(css, /\.provider-categories \{ min-width: 0; display: flex; flex: 1 1 auto;/);
});
test("Amit Mitrani has a complete verified supplier profile", async () => {
  const [worldData, details, results] = await Promise.all([
    read("../app/data/world-data.ts"),
    read("../app/data/provider-details.ts"),
    read("../app/components/provider-results.tsx"),
  ]);
  assert.match(worldData, /id: "amit-mitrani-magic-man"/);
  assert.match(worldData, /sourceUrl: "https:\/\/amitgic\.co\.il\/"/);
  assert.match(worldData, /052-341-6151|עמית מיטרני, Magic Man/);
  assert.match(details, /"amit-mitrani-magic-man": \{/);
  assert.match(details, /phone: "052-341-6151"/);
  assert.match(details, /bookingMode: "whatsapp"/);
  assert.match(results, /id: "entertainment", label: "מופעים ואמנים"/);
});

test("Amit Mitrani uses three local official photographs", async () => {
  for (const name of ["amit-mitrani-1.webp", "amit-mitrani-2.webp", "amit-mitrani-3.webp"]) {
    const file = new URL(`../public/media/providers/amit-mitrani/${name}`, import.meta.url);
    assert.ok((await stat(file)).size > 20_000, `${name} is missing or too small`);
  }
});
