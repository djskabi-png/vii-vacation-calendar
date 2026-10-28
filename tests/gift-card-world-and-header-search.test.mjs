import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("gift card is a fully controllable world with public entry points gated by one state", async () => {
  const [availability, admin, layout, header, footer, home, search, corporate] = await Promise.all([
    read("app/lib/world-availability.ts"),
    read("app/admin/worlds/page.tsx"),
    read("app/layout.tsx"),
    read("app/site-header.tsx"),
    read("app/components/site-footer.tsx"),
    read("app/page.tsx"),
    read("app/components/search-box.tsx"),
    read("app/corporate/page.tsx"),
  ]);

  assert.match(availability, /controllableWorlds = \[[^\]]*"gift-card"/s);
  assert.match(availability, /path\.startsWith\("\/gift-card"\)/);
  assert.match(admin, /"gift-card": "גיפט קארד"/);
  assert.match(layout, /\["gift-card", "\/gift-card"\]/);
  for (const source of [header, footer, home, search, corporate]) assert.match(source, /enabled\("gift-card"\)|worldAvailability\["gift-card"\]/);
});

test("header search shortcut is world-aware and is suppressed on routes with a full search", async () => {
  const header = await read("app/site-header.tsx");
  assert.match(header, /const hasInPageSearch = pathname === "\/"/);
  assert.match(header, /pathname\.startsWith\("\/events\/search"\)/);
  assert.match(header, /pathname\.startsWith\("\/spas\/search"\)/);
  assert.match(header, /pathname\.startsWith\("\/hourly\/search"\)/);
  assert.match(header, /!hasInPageSearch \? <Link className="icon-button header-search" href=\{searchHref\}/);
  assert.match(header, /events: "\/events"/);
  assert.match(header, /spa: "\/spas"/);
});
