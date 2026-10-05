import { createHash } from "node:crypto";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";

const API_ROOT = "https://bizonline.co.il/api/ai/vii";
const OUTPUT_DIR = new URL("../tmp/vii-sergey-stage-20261005/", import.meta.url);
const WORLDS = ["vacations", "events"];
const MAX_CONCURRENT = 6;
const DEADLINE_MS = 8 * 60_000;

async function tokenFromStdin() {
  if (process.env.SERGEY_VII_API_TOKEN) return process.env.SERGEY_VII_API_TOKEN;
  if (!process.argv.includes("--token-stdin")) throw new Error("SERGEY_VII_API_TOKEN is required");
  let value = "";
  for await (const chunk of process.stdin) {
    value += chunk;
    if (value.includes("\n")) break;
  }
  const token = value.trim();
  if (!token) throw new Error("SERGEY_VII_API_TOKEN is required");
  return token;
}

function pictures(galleries) {
  const groups = Array.isArray(galleries) ? galleries : Object.values(galleries && typeof galleries === "object" ? galleries : {});
  return [...new Set(groups.flatMap((group) => Array.isArray(group?.pictures) ? group.pictures : []))]
    .filter((path) => typeof path === "string" && /^\/gallery\/[\w.-]+$/.test(path));
}

async function main() {
  const token = await tokenFromStdin();
  const started = Date.now();
  async function get(path) {
    if (Date.now() - started > DEADLINE_MS) throw new Error("Import deadline exceeded");
    const response = await fetch(`${API_ROOT}${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
    return response.json();
  }

  const [locations, ...worldLists] = await Promise.all([get("/locations"), ...WORLDS.map((world) => get(`/${world}`))]);
  if (!Array.isArray(locations.cities) || !Array.isArray(locations.areas)) throw new Error("Invalid location lookup");
  const cityById = new Map(locations.cities.map((city) => [city.id, city]));
  const areaById = new Map(locations.areas.map((area) => [area.id, area]));
  const tasks = WORLDS.flatMap((world, index) => {
    const list = worldLists[index]?.places;
    if (!Array.isArray(list)) throw new Error(`${world}: invalid list`);
    const ids = list.filter((place) => place.active === true).map((place) => place.siteID);
    if (ids.length !== new Set(ids).size) throw new Error(`${world}: duplicate active IDs`);
    return list.filter((place) => place.active === true).map((place) => ({ world, list: place }));
  });

  const records = new Array(tasks.length);
  let cursor = 0;
  const failures = [];
  async function worker() {
    while (cursor < tasks.length && failures.length === 0) {
      const index = cursor++;
      const { world, list } = tasks[index];
      try {
        const detail = await get(`/${world}/${list.siteID}`);
        if (detail.id !== list.siteID || detail.active !== true || !String(detail.name || "").trim()) throw new Error("invalid detail identity");
        const images = pictures(detail.galleries);
        if (!images.length) throw new Error("no usable source images");
        const city = cityById.get(detail.location?.city);
        const area = areaById.get(city?.area);
        records[index] = {
          world,
          supplierId: list.siteID,
          name: detail.name,
          alternateName: list.siteName !== detail.name ? list.siteName : null,
          sourceUrl: detail.page_url,
          city: city?.title || null,
          area: area?.title || null,
          lat: detail.gps?.lat ?? null,
          lng: detail.gps?.long ?? null,
          images,
          roomCount: Array.isArray(detail.rooms) ? detail.rooms.length : 0,
          hasPrices: detail.has_prices === true,
          hasAvailability: list.has_availability === true,
          metaTitle: detail.meta?.title || null,
          metaDescription: detail.meta?.description || null,
          raw: detail,
        };
      } catch (error) {
        failures.push({ world, supplierId: list.siteID, reason: error instanceof Error ? error.message : "unknown_error" });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENT, tasks.length) }, worker));
  if (failures.length || records.some((record) => !record)) {
    throw new Error(`Import rejected: ${JSON.stringify(failures.slice(0, 6))}`);
  }

  const raw = { fetchedAt: new Date().toISOString(), locations, lists: Object.fromEntries(WORLDS.map((world, index) => [world, worldLists[index]])), details: records.map(({ world, supplierId, raw }) => ({ world, supplierId, raw })) };
  const rawBytes = gzipSync(Buffer.from(JSON.stringify(raw)));
  const normalized = records.map(({ raw: _raw, ...record }) => record);
  const manifest = {
    fetchedAt: raw.fetchedAt,
    source: API_ROOT,
    active: Object.fromEntries(WORLDS.map((world) => [world, normalized.filter((record) => record.world === world).length])),
    rawSha256: createHash("sha256").update(rawBytes).digest("hex"),
    missingCity: normalized.filter((record) => !record.city).length,
    missingSeo: normalized.filter((record) => !record.metaTitle || !record.metaDescription).length,
    nameDifferences: normalized.filter((record) => record.alternateName).length,
  };

  await mkdir(OUTPUT_DIR, { recursive: true });
  const files = [
    ["raw.json.gz", rawBytes],
    ["catalog.json", JSON.stringify(normalized)],
    ["manifest.json", JSON.stringify(manifest, null, 2)],
  ];
  for (const [name, contents] of files) await writeFile(new URL(`${name}.pending`, OUTPUT_DIR), contents, { flag: "wx" });
  for (const [name] of files) await rename(new URL(`${name}.pending`, OUTPUT_DIR), new URL(name, OUTPUT_DIR));
  console.log(JSON.stringify({ ...manifest, rawBytes: rawBytes.length, elapsedSeconds: Math.round((Date.now() - started) / 1000) }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Import failed");
  process.exitCode = 1;
});
