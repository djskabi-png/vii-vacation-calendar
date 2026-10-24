import { readFile } from "node:fs/promises";

const inventory = JSON.parse(await readFile(new URL("../app/data/legacy-redirect-inventory.json", import.meta.url), "utf8"));
const known = new Set([...Object.keys(inventory.redirects || {}), ...(inventory.gone || [])]);

function locations(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/gi)].map((match) => match[1].trim());
}

function normalizedPath(value) {
  const url = new URL(value, "https://www.vii.co.il");
  const pathname = (url.pathname.replace(/\/+$/, "") || "/").toLowerCase();
  if (!url.search) return pathname;
  const search = new URLSearchParams(url.search);
  search.sort();
  return `${pathname}?${search.toString()}`;
}

async function xml(url) {
  const response = await fetch(url, {
    headers: { Accept: "application/xml,text/xml;q=0.9,*/*;q=0.8", "User-Agent": "VII legacy coverage audit/1.0" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.text();
}

const childSitemaps = locations(await xml("https://www.vii.co.il/sitemap.php"));
if (!childSitemaps.length) throw new Error("Legacy sitemap index has no children");
const liveUrls = new Set();
for (const child of childSitemaps) for (const url of locations(await xml(child))) liveUrls.add(normalizedPath(url));
liveUrls.delete("/");
const missing = [...liveUrls].filter((source) => !known.has(source)).sort();
const result = {
  checkedAt: new Date().toISOString(),
  childSitemaps: childSitemaps.length,
  liveLegacyUrls: liveUrls.size,
  classifiedUrls: liveUrls.size - missing.length,
  missing,
};
console.log(JSON.stringify(result, null, 2));
if (missing.length) process.exitCode = 1;
