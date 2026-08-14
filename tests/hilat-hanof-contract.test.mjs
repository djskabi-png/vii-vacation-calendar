import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");

test("Hilat HaNof is a verified four-cabin legacy property", async () => {
  const catalog = await readFile(resolve(root, "app/data/site-data.ts"), "utf8");
  const profiles = await readFile(resolve(root, "app/data/legacy-vacation-profiles.ts"), "utf8");
  const start = catalog.indexOf('slug: "hilat-hanof"');
  const end = catalog.indexOf('slug: "ar-suites"', start);
  const listing = catalog.slice(start, end);

  assert.ok(start > 0 && end > start);
  assert.match(listing, /name: "הילת הנוף"/);
  assert.match(listing, /units: 4/);
  assert.match(listing, /guests: 25/);
  assert.match(listing, /scenario: "multi"/);
  assert.match(listing, /reviewSource: "legacy-verified"/);
  assert.match(listing, /contact: \{ phone: "052-9097258", whatsapp: "052-9097258" \}/);
  assert.doesNotMatch(listing, /price:/, "the current legacy page does not expose a verified public price");
  for (const cabin of [1, 2, 3, 4]) assert.match(listing, new RegExp(`name: "בקתה ${cabin}"`));

  assert.match(profiles, /"hilat-hanof": \{/);
  assert.match(profiles, /sourceUrl: "https:\/\/www\.vii\.co\.il\/hilat_hanof"/);
  assert.match(profiles, /reviewCount: 180/);
  assert.match(profiles, /checkedAt: "2026-08-14"/);
});

test("Hilat HaNof keeps the complete verified legacy gallery locally", async () => {
  const media = await readdir(resolve(root, "public/media/hilat-hanof"));
  assert.equal(media.length, 46);
  assert.ok(media.every((file) => /\.(?:jpg|jpeg)$/i.test(file)));
  assert.ok(media.includes("87686399e3d2342.jpg"));
  assert.ok(media.includes("535f7c268ed1dc4.jpeg"));
  assert.ok(media.includes("105f7c26ece1d6d.jpeg"));
  assert.ok(media.includes("47686399e3e350c.jpg"));
});
