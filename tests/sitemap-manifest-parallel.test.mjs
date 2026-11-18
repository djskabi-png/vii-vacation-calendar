import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("sitemap manifest resolves independent sections concurrently without changing order", async () => {
  const source = await readFile(new URL("../app/lib/sitemap-inventory.ts", import.meta.url), "utf8");
  const manifest = source.slice(source.indexOf("export async function sitemapManifest"), source.indexOf("export async function sitemapInventory"));
  assert.match(manifest, /return Promise\.all\(sitemapSectionOrder\.map\(async \(section\)/);
  assert.doesNotMatch(manifest, /for \(const section of sitemapSectionOrder\).*await sitemapSection/s);
});
