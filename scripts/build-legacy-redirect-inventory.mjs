import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const [, , gscCsvArgument, outputArgument = "app/data/legacy-redirect-inventory.json"] = process.argv;
if (!gscCsvArgument) throw new Error("Usage: node scripts/build-legacy-redirect-inventory.mjs <gsc-pages.csv> [output.json]");

const root = process.cwd();
const catalog = JSON.parse(await readFile(resolve(root, "app/data/sergey-public-catalog.json"), "utf8"));
const hourly = JSON.parse(await readFile(resolve(root, "app/data/sergey-hourly-catalog.json"), "utf8"));

function normalizedPath(value) {
  const url = value instanceof URL ? value : new URL(value, "https://www.vii.co.il");
  const pathname = (url.pathname.replace(/\/+$/, "") || "/").toLowerCase();
  if (!url.search) return pathname;
  const search = new URLSearchParams(url.search);
  search.sort();
  return `${pathname}?${search.toString()}`;
}

const destinations = new Map();
function addDestination(source, target) {
  const key = normalizedPath(source);
  const existing = destinations.get(key);
  if (existing && existing !== target) throw new Error(`Conflicting destinations for ${key}: ${existing} and ${target}`);
  destinations.set(key, target);
}

for (const place of catalog.places || []) {
  if (place.world === "vacations") addDestination(place.sourceUrl, `/business?id=${place.slug}`);
  if (place.world === "events") addDestination(place.sourceUrl, `/events/place/${place.slug}`);
}
for (const place of hourly.places || []) addDestination(place.sourceUrl, `/discover/place/${place.id}`);
addDestination("https://www.vii.co.il/rooms/ascape_room", "/discover/place/hourly-1915");

for (const [source, target] of [
  ["/term_and_conditions", "/legal/terms"],
  ["/privacy_policy", "/legal/privacy"],
  ["/%D7%91%D7%99%D7%98%D7%95%D7%9C_%D7%94%D7%96%D7%9E%D7%A0%D7%94", "/legal/cancellation"],
  ["/%D7%A6%D7%95%D7%A8_%D7%A7%D7%A9%D7%A8", "/join"],
]) addDestination(source, target);

const newSitemapIndex = await (await fetch("https://vii.spaplus.co/sitemap.xml")).text();
const newSitemapChildren = [...newSitemapIndex.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1].trim());
if (!newSitemapChildren.length) throw new Error("New sitemap index returned no child sitemaps");
const newSitemapTargets = new Set();
for (const child of newSitemapChildren) {
  const xml = await (await fetch(child)).text();
  for (const match of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) newSitemapTargets.add(normalizedPath(match[1].trim()));
}
for (const [source, target] of destinations) {
  if (/^\/(?:business|events\/place|discover\/place)(?:[/?]|$)/.test(target) && !newSitemapTargets.has(normalizedPath(target))) {
    destinations.delete(source);
  }
}

const sitemapIndex = await (await fetch("https://www.vii.co.il/sitemap.php")).text();
const sitemapChildren = [...sitemapIndex.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1].trim());
if (!sitemapChildren.length) throw new Error("Legacy sitemap index returned no child sitemaps");
const legacyUrls = [];
for (const child of sitemapChildren) {
  const xml = await (await fetch(child)).text();
  legacyUrls.push(...[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1].trim()));
}

const gscCsv = await readFile(resolve(gscCsvArgument), "utf8");
const gscRows = gscCsv.replace(/^\uFEFF/, "").split(/\r?\n/).slice(1).filter(Boolean).map((line) => {
  const columns = line.match(/(?:^|,)("(?:[^"]|"")*"|[^,]*)/g)?.map((value) => value.replace(/^,/, "").replace(/^"|"$/g, "").replace(/""/g, '"')) || [];
  return { url: columns[0], clicks: Number(columns[1] || 0), impressions: Number(columns[2] || 0) };
}).filter((row) => /^https?:\/\//.test(row.url));

const currentLocations = [...new Set((catalog.places || []).filter((place) => place.world === "vacations")
  .flatMap((place) => [place.location, place.area]).filter((value) => typeof value === "string" && value.trim()))]
  .sort((first, second) => second.length - first.length);

function htmlText(value) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&quot;/g, '"').replace(/&#039;|&apos;/g, "'").replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ").trim();
}

const searchRows = gscRows.filter((row) => {
  const pathname = new URL(row.url).pathname.toLowerCase();
  return pathname === "/s/" || pathname.startsWith("/s/") || pathname.startsWith("/events/s/");
});

const searchTargets = new Map();
let nextIndex = 0;
async function classifySearchPages() {
  while (nextIndex < searchRows.length) {
    const row = searchRows[nextIndex++];
    const url = new URL(row.url);
    if (url.pathname.toLowerCase().startsWith("/events/s/")) {
      searchTargets.set(normalizedPath(url), "/events");
      continue;
    }
    try {
      const response = await fetch(url, { redirect: "follow" });
      if (!response.ok) continue;
      const html = await response.text();
      const headingMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
      const heading = headingMatch ? htmlText(headingMatch[1]) : "";
      const location = currentLocations.find((candidate) => heading.includes(candidate));
      const params = new URLSearchParams();
      if (location) params.set("location", location);
      if (/בריכ/.test(heading)) params.set("pool", "1");
      if (/נגיש/.test(heading)) params.set("accessible", "1");
      const features = [];
      for (const [pattern, feature] of [
        [/בני נוער/, "youth"], [/משפחות?/, "families"], [/זוגות?/, "couples"],
        [/מסיב(?:ה|ות)/, "parties"], [/יום הולדת|ימי הולדת/, "birthdays"], [/קבוצות?/, "groups"],
      ]) if (pattern.test(heading)) features.push(feature);
      if (features.length) params.set("features", [...new Set(features)].join(","));
      if (location || features.length || params.has("pool") || params.has("accessible")) {
        searchTargets.set(normalizedPath(url), `/search?${params.toString()}`);
      }
    } catch (error) {
      console.warn(`Could not classify ${row.url}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

await Promise.all(Array.from({ length: Math.min(12, searchRows.length || 1) }, () => classifySearchPages()));

const sources = new Map();
function record(sourceUrl, origin) {
  const key = normalizedPath(sourceUrl);
  if (key === "/") return;
  const target = destinations.get(key) || searchTargets.get(key) || null;
  const prior = sources.get(key);
  const next = { status: target ? 301 : 410, ...(target ? { target } : {}), origins: [...new Set([...(prior?.origins || []), origin])] };
  sources.set(key, next);
}
for (const url of legacyUrls) record(url, "legacy-sitemap");
for (const row of gscRows) record(row.url, "search-console-performance");
for (const [source, target] of destinations) {
  if (source !== "/") sources.set(source, { status: 301, target, origins: [...new Set([...(sources.get(source)?.origins || []), "current-catalog"])] });
}

const orderedEntries = [...sources].sort(([first], [second]) => first.localeCompare(second, "en"));
const redirectEntries = orderedEntries.filter(([, entry]) => entry.status === 301);
const goneEntries = orderedEntries.filter(([, entry]) => entry.status === 410);
const output = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  sourceSnapshots: {
    legacySitemap: "https://www.vii.co.il/sitemap.php",
    legacySitemapUrlCount: new Set(legacyUrls.map(normalizedPath)).size,
    searchConsoleReport: "sc-domain:vii.co.il, Search performance, Pages, previous 3 months, top 1000",
    searchConsoleUrlCount: gscRows.length,
    newSitemap: "https://vii.spaplus.co/sitemap.xml",
    newSitemapUrlCount: newSitemapTargets.size,
  },
  stats: {
    total: orderedEntries.length,
    redirects: redirectEntries.length,
    gone: goneEntries.length,
    managedSearchRedirects: searchTargets.size,
  },
  redirects: Object.fromEntries(redirectEntries.map(([source, entry]) => [source, entry.target])),
  gone: goneEntries.map(([source]) => source),
};

await writeFile(resolve(root, outputArgument), `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(JSON.stringify(output.stats));
