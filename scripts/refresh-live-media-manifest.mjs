#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const manifestPath = resolve(root, "app/data/legacy-gallery-media.json");
const baseUrl = String(process.env.VII_PUBLIC_BASE_URL || process.argv[2] || "https://vii.spaplus.co").replace(/\/$/, "");
const worlds = ["vacations", "events", "rooms", "spa"];
const detailWorlds = new Set(["vacations", "events"]);
const concurrency = Math.max(1, Math.min(12, Number(process.env.VII_MEDIA_CATALOG_CONCURRENCY || 6)));
const filenamePattern = /^\/api\/vii\/media\/([A-Za-z0-9._-]+\.(?:avif|gif|jfif|jpe?g|png|webp))$/i;

async function json(url) {
  const response = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "VII live media inventory refresh" }, signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json();
}

function collect(value, files) {
  if (typeof value === "string") {
    const match = value.match(filenamePattern);
    if (match) files.add(match[1]);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collect(item, files);
    return;
  }
  if (value && typeof value === "object") for (const item of Object.values(value)) collect(item, files);
}

async function pool(items, worker) {
  let cursor = 0;
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (cursor < items.length) await worker(items[cursor++]);
  }));
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const previous = new Set(manifest.files);
const current = new Set(manifest.files);
const details = [];
for (const world of worlds) {
  const catalog = await json(`${baseUrl}/api/catalog?world=${world}`);
  collect(catalog, current);
  if (detailWorlds.has(world)) {
    for (const entry of Array.isArray(catalog.entries) ? catalog.entries : []) {
      const supplierId = Number(entry?.supplierId);
      if (Number.isSafeInteger(supplierId) && supplierId > 0) details.push({ world, supplierId });
    }
  }
}
await pool(details, async ({ world, supplierId }) => collect(await json(`${baseUrl}/api/catalog?world=${world}&id=${supplierId}`), current));

manifest.files = [...current].sort((left, right) => left.localeCompare(right));
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
const added = manifest.files.filter((filename) => !previous.has(filename));
console.log(JSON.stringify({ baseUrl, catalogs: worlds.length, details: details.length, previous: previous.size, current: current.size, added: added.length, addedFiles: added }, null, 2));
