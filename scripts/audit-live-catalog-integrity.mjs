import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const base = (process.argv[2] || "https://vii.spaplus.co").replace(/\/$/, "");
const output = process.argv[3] || path.resolve("project_knowledge/release_evidence/live-catalog-integrity");
const concurrency = Math.max(1, Math.min(6, Number(process.env.VII_AUDIT_CONCURRENCY || 3)));
const worlds = ["vacations", "events", "rooms", "spa"];
const timeoutMs = 30_000;

await mkdir(output, { recursive: true });

async function request(url, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = performance.now();
  try {
    const response = await fetch(url, { redirect: "follow", ...init, signal: controller.signal, headers: { "user-agent": "VII bounded catalog integrity audit", ...(init.headers || {}) } });
    return { response, elapsedMs: Math.round(performance.now() - started) };
  } finally {
    clearTimeout(timer);
  }
}

async function pool(items, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      try { results[index] = await worker(items[index], index); }
      catch (error) { results[index] = { ...items[index], ok: false, error: error instanceof Error ? error.message : String(error) }; }
    }
  }));
  return results;
}

function primaryImage(summary) {
  const candidate = summary?.image || summary?.imageUrl || summary?.coverImage || summary?.images?.[0];
  return typeof candidate === "string" && candidate.trim() ? new URL(candidate, base).href : null;
}

const report = { base, checkedAt: new Date().toISOString(), concurrency, worlds: [], totals: {}, failures: [] };
const pageTargets = [];
const imageTargets = new Map();

for (const world of worlds) {
  const [lookupResult, fullResult] = await Promise.all([
    request(`${base}/api/catalog?world=${world}&view=lookup`),
    request(`${base}/api/catalog?world=${world}`),
  ]);
  assert.equal(lookupResult.response.status, 200, `${world} lookup`);
  assert.equal(fullResult.response.status, 200, `${world} full catalog`);
  const lookup = await lookupResult.response.json();
  const full = await fullResult.response.json();
  const places = Array.isArray(lookup.places) ? lookup.places : [];
  const entries = Array.isArray(full.entries) ? full.entries : [];
  const lookupIds = new Set(places.map(place => String(place.id)));
  const entryById = new Map(entries.map(entry => [String(entry.summary?.slug || (world === "spa" ? `spa-${entry.supplierId}` : entry.summary?.id) || `${world === "rooms" ? "hourly" : world === "events" ? "event" : "vacation"}-${entry.supplierId}`), entry]));
  const malformed = places.filter(place => !place?.id || !place?.name || !place?.href?.startsWith("/"));
  const missingDetails = places.filter(place => !entryById.has(String(place.id))).map(place => place.id);
  const orphanDetails = [...entryById.keys()].filter(id => !lookupIds.has(id));
  const worldRow = {
    world,
    source: lookup.source,
    lookupCount: places.length,
    detailCount: entries.length,
    lookupMs: lookupResult.elapsedMs,
    fullMs: fullResult.elapsedMs,
    malformed: malformed.map(place => place?.id || null),
    missingDetails,
    orphanDetails,
  };
  report.worlds.push(worldRow);
  for (const place of places) {
    pageTargets.push({ world, id: place.id, name: place.name, href: place.href });
    const entry = entryById.get(String(place.id));
    const image = primaryImage(entry?.summary);
    if (image && !imageTargets.has(image)) imageTargets.set(image, { world, id: place.id, image });
  }
  if (malformed.length || missingDetails.length || orphanDetails.length) report.failures.push({ type: "catalog-reconciliation", ...worldRow });
}

const pageResults = await pool(pageTargets, async target => {
  const { response, elapsedMs } = await request(new URL(target.href, base));
  const html = await response.text();
  const ok = response.status === 200 && /<h1(?:\s|>)/i.test(html) && !/Application error|Internal Server Error/i.test(html);
  return { ...target, ok, status: response.status, elapsedMs, dataOrigin: response.headers.get("x-vii-data-origin"), hasH1: /<h1(?:\s|>)/i.test(html) };
});

const imageResults = await pool([...imageTargets.values()], async target => {
  const { response, elapsedMs } = await request(target.image, { headers: { Range: "bytes=0-2047" } });
  const contentType = response.headers.get("content-type") || "";
  const ok = [200, 206].includes(response.status) && contentType.startsWith("image/");
  await response.body?.cancel();
  return { ...target, ok, status: response.status, elapsedMs, contentType };
});

report.pages = pageResults;
report.images = imageResults;
report.failures.push(...pageResults.filter(result => !result?.ok).map(result => ({ type: "page", ...result })));
report.failures.push(...imageResults.filter(result => !result?.ok).map(result => ({ type: "primary-image", ...result })));
report.totals = {
  entities: pageTargets.length,
  pagesPassed: pageResults.filter(result => result?.ok).length,
  uniquePrimaryImages: imageResults.length,
  imagesPassed: imageResults.filter(result => result?.ok).length,
  failures: report.failures.length,
};
report.status = report.failures.length ? "failed" : "passed";
await writeFile(path.join(output, "catalog-integrity.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ status: report.status, totals: report.totals, worlds: report.worlds.map(({ world, source, lookupCount, detailCount }) => ({ world, source, lookupCount, detailCount })) }, null, 2));
if (report.failures.length) process.exitCode = 1;
