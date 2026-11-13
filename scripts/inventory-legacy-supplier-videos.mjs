import { mkdir, readFile, writeFile } from "node:fs/promises";
import process from "node:process";

const root = new URL("../", import.meta.url);
const catalogPath = new URL("app/data/sergey-public-catalog.json", root);
const outputPath = new URL("app/data/verified-legacy-supplier-videos.ts", root);
const reportPath = new URL("project_knowledge/media/legacy-supplier-video-inventory-20261113.json", root);
const args = new Set(process.argv.slice(2));
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const limit = limitArg ? Math.max(1, Number(limitArg.split("=")[1]) || 1) : Number.POSITIVE_INFINITY;
const write = args.has("--write");
const concurrency = 2;
const timeoutMs = 12_000;

const youtubePatterns = [
  /(?:youtube(?:-nocookie)?\.com\/embed\/|youtu\.be\/)([A-Za-z0-9_-]{11})(?:[^A-Za-z0-9_-]|$)/gi,
  /youtube\.com\/watch\?(?:[^"'<>\s&]+&amp;|[^"'<>\s&]+&)*v=([A-Za-z0-9_-]{11})(?:[^A-Za-z0-9_-]|$)/gi,
];

function videoIds(html) {
  const ids = new Set();
  for (const pattern of youtubePatterns) {
    for (const match of html.matchAll(pattern)) ids.add(match[1]);
  }
  return [...ids];
}

async function inspect(place) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(place.sourceUrl, {
      signal: controller.signal,
      headers: { "user-agent": "VII legacy media migration audit/1.0" },
      redirect: "follow",
    });
    const html = await response.text();
    return {
      slug: place.slug,
      name: place.name,
      sourceUrl: place.sourceUrl,
      status: response.status,
      ids: response.ok ? videoIds(html) : [],
      error: response.ok ? "" : `HTTP ${response.status}`,
    };
  } catch (error) {
    return { slug: place.slug, name: place.name, sourceUrl: place.sourceUrl, status: 0, ids: [], error: error instanceof Error ? error.message : String(error) };
  } finally {
    clearTimeout(timeout);
  }
}

const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
const places = catalog.places.filter((place) => place.slug && /^https:\/\/www\.vii\.co\.il\//.test(place.sourceUrl || "")).slice(0, limit);
const results = [];
let cursor = 0;
await Promise.all(Array.from({ length: Math.min(concurrency, places.length) }, async () => {
  while (cursor < places.length) {
    const index = cursor++;
    results[index] = await inspect(places[index]);
    await new Promise((resolve) => setTimeout(resolve, 125));
  }
}));

const verifiedAt = new Date().toISOString().slice(0, 10);
const registry = Object.fromEntries(results
  .filter((result) => result.ids.length)
  .map((result) => [result.slug, result.ids.map((youtubeId, index) => ({
    title: index ? `סרטון נוסף מ${result.name}` : `סרטון מ${result.name}`,
    youtubeId,
    sourceUrl: result.sourceUrl,
    verifiedAt,
  }))]));
const report = {
  generatedAt: new Date().toISOString(),
  sourceCatalogFetchedAt: catalog.fetchedAt,
  inspected: results.length,
  successful: results.filter((result) => result.status >= 200 && result.status < 400).length,
  failures: results.filter((result) => result.error),
  placesWithVideos: Object.keys(registry).length,
  videos: Object.values(registry).flat().length,
  registry,
};

if (write) {
  await mkdir(new URL("project_knowledge/media/", root), { recursive: true });
  await writeFile(outputPath, `const verifiedLegacySupplierVideos = ${JSON.stringify(registry, null, 2)} as const;\nexport default verifiedLegacySupplierVideos;\n`, "utf8");
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}
process.stdout.write(`${JSON.stringify({ inspected: report.inspected, successful: report.successful, failures: report.failures.length, placesWithVideos: report.placesWithVideos, videos: report.videos, write })}\n`);
if (report.failures.length) process.exitCode = 2;
