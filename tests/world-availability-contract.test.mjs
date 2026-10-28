import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("world launch control has one persisted source and is wired across public chrome", async () => {
  const [state, route, page, layout, header, switcher, footer, nav, policy, home, searchBox, corporate] = await Promise.all([
    read("app/lib/world-availability.ts"), read("app/api/admin/worlds/route.ts"), read("app/admin/worlds/page.tsx"),
    read("app/layout.tsx"), read("app/site-header.tsx"), read("app/components/world-switcher.tsx"),
    read("app/components/site-footer.tsx"), read("app/admin/admin-nav.tsx"), read("app/admin/access-policy.ts"),
    read("app/page.tsx"), read("app/components/search-box.tsx"), read("app/corporate/page.tsx"),
  ]);
  assert.match(state, /vii_world_availability/);
  assert.match(state, /worldForPath/);
  assert.match(route, /authorizedAdminSession/);
  assert.match(route, /setWorldAvailability/);
  assert.match(page, /כיבוי העולם/);
  assert.match(layout, /WorldAvailabilityProvider/);
  assert.match(layout, /redirect\(fallback\)/);
  assert.match(header, /filter\(\(item\) => enabled/);
  assert.match(switcher, /headerWorldOptions\(language\)\.filter/);
  assert.match(switcher, /primaryWorlds\.filter\(enabled\)/);
  assert.match(footer, /filter\(\(item\) => enabled/);
  assert.match(nav, /\/admin\/worlds/);
  assert.match(policy, /id: "worlds"/);
  assert.match(state, /"gift-card"/);
  assert.match(state, /path\.startsWith\("\/gift-card"\)/);
  assert.match(page, /"gift-card": "גיפט קארד"/);
  assert.match(header, /enabled\("gift-card"\)/);
  assert.match(footer, /enabled\("gift-card"\)/);
  assert.match(home, /worldAvailability\["gift-card"\]/);
  assert.match(searchBox, /enabled\("gift-card"\)/);
  assert.match(corporate, /worldAvailability\["gift-card"\]/);
});
