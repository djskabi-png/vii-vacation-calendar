import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const data = await readFile(new URL("../app/data/world-data.ts", import.meta.url), "utf8");
const header = await readFile(new URL("../app/site-header.tsx", import.meta.url), "utf8");
const switcher = await readFile(new URL("../app/components/world-switcher.tsx", import.meta.url), "utf8");
const footer = await readFile(new URL("../app/components/site-footer.tsx", import.meta.url), "utf8");
const home = await readFile(new URL("../app/components/home-showcase.tsx", import.meta.url), "utf8");
const business = await readFile(new URL("../app/business/client-page.tsx", import.meta.url), "utf8");
const worldLanding = await readFile(new URL("../app/components/world-landing.tsx", import.meta.url), "utf8");
const sitemap = await readFile(new URL("../app/sitemap.ts", import.meta.url), "utf8");
const attractions = await readFile(new URL("../app/attractions/page.tsx", import.meta.url), "utf8");
const trails = await readFile(new URL("../app/trails/page.tsx", import.meta.url), "utf8");
const trailDetail = await readFile(new URL("../app/trails/[slug]/page.tsx", import.meta.url), "utf8");
const concierge = await readFile(new URL("../app/components/smart-concierge.tsx", import.meta.url), "utf8");

test("public navigation replaces the generic activities hub with trails and attractions", () => {
  assert.match(data, /publicWorldNavigation/);
  assert.match(data, /id: "trails"[\s\S]*href: "\/trails"/);
  assert.match(data, /id: "attractions"[\s\S]*href: "\/attractions"/);
  assert.match(data, /world\.id !== "activities"/);
  assert.match(switcher, /publicWorldNavigation\.map/);
});

test("header, footer and homepage link directly to both dedicated pages", () => {
  assert.match(header, /href: "\/trails", label: "מסלולי טיול"/);
  assert.match(header, /href: "\/attractions", label: "אטרקציות"/);
  assert.doesNotMatch(footer, /href="\/activities"/);
  assert.match(footer, /href="\/trails">מסלולי טיולים/);
  assert.match(footer, /href="\/attractions">אטרקציות/);
  assert.match(home, /publicWorldNavigation\.filter/);
});

test("public discovery links and breadcrumbs never route through the generic hub", () => {
  for (const source of [header, switcher, footer, home, business, worldLanding, attractions, trails, trailDetail]) {
    assert.doesNotMatch(source, /(?:href|path):?\s*=??\s*["'{]\/activities/);
  }
  assert.doesNotMatch(sitemap, /item\("\/activities\//);
  assert.match(business, /href="\/trails"[\s\S]*href="\/attractions"/);
  assert.match(worldLanding, /href: "\/trails"[\s\S]*href: "\/attractions"/);
  assert.match(concierge, /intent === "trails"\) return "\/trails\/"/);
  assert.match(concierge, /intent === "activities"\) return "\/attractions\/"/);
});
